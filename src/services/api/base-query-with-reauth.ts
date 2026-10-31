import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { selectAuth, sessionEnded, sessionFailed } from '@services/auth/auth-slice';
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
import type { RootState } from '@services/store';

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
  selectAuth(api.getState() as RootState).version;

const endSession = (api: BaseQueryApi): void => {
  let storageFailed = false;
  try {
    clearTokens();
  } catch {
    storageFailed = true;
  }
  api.dispatch(sessionEnded());
  if (storageFailed)
    api.dispatch(
      sessionFailed({ version: versionOf(api), message: storageErrorMessage })
    );
};

const withToken = (args: string | FetchArgs, token: string | undefined): FetchArgs => {
  const request = typeof args === 'string' ? { url: args } : args;
  const headers = new Headers(request.headers as HeadersInit | undefined);
  if (token) headers.set('authorization', token);
  return { ...request, headers };
};

// Каждый ожидающий запрос может прекратить ожидание, не отменяя общий refresh.
const waitForRefresh = async (
  promise: Promise<FetchBaseQueryError | undefined>,
  signal: AbortSignal
): Promise<FetchBaseQueryError | undefined> => {
  if (signal.aborted) return cancelled().error;
  return new Promise((resolve) => {
    const onAbort = (): void => {
      resolve(cancelled().error);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then((result) => {
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    });
  });
};

export const createBaseQueryWithReauth = (): BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> => {
  // Middleware разных store не делят запрос обновления (в том числе в тестах).
  const refreshes = new WeakMap<
    BaseQueryApi['dispatch'],
    { version: number; promise: Promise<FetchBaseQueryError | undefined> }
  >();

  return async (args, api, extraOptions) => {
    // Версия связывает запрос и общий refresh с сессией, в которой они начались.
    // После смены сессии их результат не должен сохранять токены или завершать новую.
    const version = versionOf(api);
    const authorized =
      api.endpoint === 'getCurrentUser' || api.endpoint === 'createOrder';
    const isCurrent = (): boolean =>
      !api.signal.aborted && (!authorized || versionOf(api) === version);
    try {
      const tokens = authorized ? readTokens() : null;
      const result = await rawQuery(
        authorized ? withToken(args, tokens?.accessToken) : args,
        api,
        extraOptions
      );
      if (!isCurrent()) return cancelled();
      if (!needsTokenRefresh(api.endpoint, tokens?.accessToken, result.error))
        return result;
      const latestTokens = readTokens();
      if (!latestTokens) {
        endSession(api);
        return result;
      }

      if (latestTokens.accessToken === tokens?.accessToken) {
        let shared = refreshes.get(api.dispatch);
        if (shared?.version !== version) {
          // Отдельный controller: abort заказа не должен обрывать проверку сессии.
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60_000);
          const promise = (async (): Promise<FetchBaseQueryError | undefined> => {
            try {
              const refresh = await rawQuery(
                {
                  url: 'auth/token',
                  method: 'POST',
                  body: { token: latestTokens.refreshToken },
                },
                { ...api, signal: controller.signal, abort: () => controller.abort() },
                extraOptions
              );
              if (versionOf(api) !== version) return cancelled().error;
              if (refresh.error) {
                if (isAccessDenied(refresh.error)) endSession(api);
                return refresh.error;
              }
              if (!isTokenResponse(refresh.data))
                return failure('Некорректный ответ обновления сессии').error;
              saveTokens(refresh.data);
              return undefined;
            } catch {
              if (versionOf(api) === version)
                api.dispatch(sessionFailed({ version, message: storageErrorMessage }));
              return failure(storageErrorMessage).error;
            } finally {
              clearTimeout(timeout);
            }
          })();
          shared = { version, promise };
          refreshes.set(api.dispatch, shared);
          const entry = shared;
          void promise.finally(() => {
            if (refreshes.get(api.dispatch) === entry) refreshes.delete(api.dispatch);
          });
        }
        const refreshError = await waitForRefresh(shared.promise, api.signal);
        if (refreshError) return { error: refreshError };
      }

      if (!isCurrent()) return cancelled();
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
      if (isCurrent())
        api.dispatch(sessionFailed({ version, message: storageErrorMessage }));
      return failure(storageErrorMessage);
    }
  };
};
