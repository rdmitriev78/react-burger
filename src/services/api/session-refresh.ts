import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { sessionEnded, sessionFailed } from '@services/auth/auth-slice';
import { isTokenResponse } from '@services/auth/auth.types';
import {
  clearTokens,
  readTokens,
  saveTokens,
  storageErrorMessage,
} from '@services/auth/token-storage';

import { isAccessDenied } from './auth-error';

import type { BaseQueryApi, FetchBaseQueryError } from '@reduxjs/toolkit/query';

export type TSessionApi = Pick<BaseQueryApi, 'dispatch' | 'getState' | 'extra'>;

// Транспорту нужно только поколение, а не полная структура store.
type TSessionState = {
  auth: { version: number };
};

type TReauthOptions = {
  // Токен при наличии и общий refresh, без запрета гостевых запросов.
  auth?: boolean;
};

export const rawQuery = fetchBaseQuery({
  baseUrl: 'https://new-stellarburgers.education-services.ru/api/',
  fetchFn: (input, init) => fetch(input, init),
});

export const failure = (error: string): { error: FetchBaseQueryError } => ({
  error: { status: 'CUSTOM_ERROR', error },
});

export const cancelled = (): { error: FetchBaseQueryError } =>
  failure('Операция больше не актуальна');

export const versionOf = (api: TSessionApi): number =>
  (api.getState() as TSessionState).auth.version;

export const endSession = (api: TSessionApi): void => {
  try {
    try {
      clearTokens();
    } finally {
      // Подтверждённый отказ инвалидирует старые операции и при сбое очистки.
      api.dispatch(sessionEnded());
    }
  } catch {
    api.dispatch(sessionFailed(storageErrorMessage));
  }
};

// Разные store (включая тестовые) не разделяют выполняющееся обновление.
const refreshes = new WeakMap<
  BaseQueryApi['dispatch'],
  { version: number; promise: Promise<FetchBaseQueryError | undefined> }
>();

const refreshTokens = async (
  token: string,
  version: number,
  api: TSessionApi,
  extraOptions: TReauthOptions
): Promise<FetchBaseQueryError | undefined> => {
  // Отмена одного потребителя не отменяет общий refresh.
  const controller = new AbortController();
  // Ограничиваем время общего refresh, чтобы зависший ответ не блокировал
  // ожидающие его запросы. Штатный timeout fetchBaseQuery 2.9.0 прекращает
  // отсчёт после получения заголовков; наш таймер охватывает и чтение тела.
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const refresh = await rawQuery(
      {
        url: 'auth/token',
        method: 'POST',
        body: { token },
      },
      {
        ...api,
        signal: controller.signal,
        abort: () => controller.abort(),
        endpoint: 'refreshSession',
        type: 'mutation',
      },
      extraOptions
    );
    if (versionOf(api) !== version) return cancelled().error;
    if (controller.signal.aborted) {
      return {
        status: 'TIMEOUT_ERROR',
        error: 'Превышено время ожидания обновления сессии',
      };
    }
    if (refresh.error) {
      if (isAccessDenied(refresh.error)) endSession(api);
      return refresh.error;
    }
    if (!isTokenResponse(refresh.data))
      return failure('Некорректный ответ обновления сессии').error;
    saveTokens(refresh.data);
    return undefined;
  } catch {
    if (versionOf(api) !== version) return cancelled().error;
    api.dispatch(sessionFailed(storageErrorMessage));
    return failure(storageErrorMessage).error;
  } finally {
    clearTimeout(timeout);
  }
};

export const refreshSession = async (
  rejectedToken: string,
  version: number,
  api: TSessionApi
): Promise<FetchBaseQueryError | undefined> => {
  if (versionOf(api) !== version) return cancelled().error;
  const latest = readTokens();
  if (!latest) {
    endSession(api);
    return failure('Сессия завершена').error;
  }
  // Поздний отказ со старым токеном не запускает ещё один refresh.
  if (latest.accessToken !== rejectedToken) return undefined;
  let refresh = refreshes.get(api.dispatch);
  if (!refresh || refresh.version !== version) {
    const pending = {
      version,
      promise: refreshTokens(latest.refreshToken, version, api, {}),
    };
    refresh = pending;
    refreshes.set(api.dispatch, refresh);
    void pending.promise.then(() => {
      if (refreshes.get(api.dispatch) === pending) refreshes.delete(api.dispatch);
    });
  }
  return refresh.promise;
};
