import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { sessionEnded, sessionFailed } from '@services/auth/auth-slice';
import { isTokenResponse } from '@services/auth/auth.types';
import {
  clearTokens,
  readTokens,
  saveTokens,
  storageErrorMessage,
} from '@services/auth/token-storage';

import { isAccessDenied, needsTokenRefresh } from './auth-error';

import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

// Транспорту нужно только поколение, а не полная структура store.
type TSessionState = {
  auth: { version: number };
};

type TReauthOptions = {
  // Токен при наличии и общий refresh, без запрета гостевых запросов.
  auth?: boolean;
};

const rawQuery = fetchBaseQuery({
  baseUrl: 'https://new-stellarburgers.education-services.ru/api/',
  fetchFn: (input, init) => fetch(input, init),
});

const failure = (error: string): { error: FetchBaseQueryError } => ({
  error: { status: 'CUSTOM_ERROR', error },
});

const cancelled = (): { error: FetchBaseQueryError } =>
  failure('Операция больше не актуальна');

const versionOf = (api: BaseQueryApi): number =>
  (api.getState() as TSessionState).auth.version;

const endSession = (api: BaseQueryApi): void => {
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

const withToken = (args: string | FetchArgs, token: string | undefined): FetchArgs => {
  const request = typeof args === 'string' ? { url: args } : args;
  const headers = new Headers(request.headers as HeadersInit | undefined);
  if (token) headers.set('authorization', token);
  return { ...request, headers };
};

// Разные store (включая тестовые) не разделяют выполняющееся обновление.
const refreshes = new WeakMap<
  BaseQueryApi['dispatch'],
  { version: number; promise: Promise<FetchBaseQueryError | undefined> }
>();

const refreshTokens = async (
  token: string,
  version: number,
  api: BaseQueryApi,
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
      { ...api, signal: controller.signal },
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

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  TReauthOptions
> = async (args, api, extraOptions) => {
  const authorized = extraOptions?.auth === true;
  const version = versionOf(api);
  const isCurrent = (): boolean => !authorized || versionOf(api) === version;
  try {
    const tokens = authorized ? readTokens() : null;
    const result = await rawQuery(
      authorized ? withToken(args, tokens?.accessToken) : args,
      api,
      extraOptions
    );
    if (!isCurrent()) return cancelled();
    if (!needsTokenRefresh(authorized, tokens?.accessToken, result.error)) return result;
    const latestTokens = readTokens();
    if (!latestTokens) {
      endSession(api);
      return result;
    }

    // Другой запрос мог уже обновить токен до получения этого 401/403.
    if (latestTokens.accessToken === tokens?.accessToken) {
      let refresh = refreshes.get(api.dispatch);
      if (!refresh || refresh.version !== version) {
        const pending = {
          version,
          promise: refreshTokens(latestTokens.refreshToken, version, api, extraOptions),
        };
        refresh = pending;
        refreshes.set(api.dispatch, refresh);
        void pending.promise.then(() => {
          // Старый refresh не удаляет уже запущенное обновление новой сессии.
          if (refreshes.get(api.dispatch) === pending) refreshes.delete(api.dispatch);
        });
      }
      const error = await refresh.promise;
      if (error) return { error };
    }

    // После независимого refresh код отменённого потребителя тоже продолжится.
    // Завершаем его до чтения токенов и подготовки повтора.
    if (!isCurrent() || api.signal.aborted) return cancelled();
    const renewed = readTokens();
    if (!renewed) return cancelled();
    const retry = await rawQuery(
      withToken(args, renewed.accessToken),
      api,
      extraOptions
    );
    if (!isCurrent()) return cancelled();
    if (isAccessDenied(retry.error)) endSession(api);
    return retry;
  } catch {
    if (!isCurrent()) return cancelled();
    api.dispatch(sessionFailed(storageErrorMessage));
    return failure(storageErrorMessage);
  }
};
