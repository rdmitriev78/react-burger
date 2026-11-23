import { sessionFailed } from '@services/auth/auth-slice';
import { readTokens, storageErrorMessage } from '@services/auth/token-storage';

import { isAccessDenied, needsTokenRefresh } from './auth-error';
import {
  cancelled,
  endSession,
  failure,
  rawQuery,
  refreshSession,
  versionOf,
} from './session-refresh';

import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

const withToken = (args: string | FetchArgs, token: string | undefined): FetchArgs => {
  const request = typeof args === 'string' ? { url: args } : args;
  const headers = new Headers(request.headers as HeadersInit | undefined);
  if (token) headers.set('authorization', token);
  return { ...request, headers };
};

/**
 * Для запросов с auth: true добавляет токен и при 401/403 с access-токеном
 * обновляет авторизацию, затем повторяет исходный запрос один раз.
 */
export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  { auth?: boolean }
> = async (args, api, extraOptions) => {
  const authorized = extraOptions?.auth === true;
  const version = versionOf(api);
  // Результаты запросов прежней сессии не должны влиять на текущего пользователя.
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
    if (!readTokens()) {
      endSession(api);
      return result;
    }
    // Общий механизм объединяет параллельные refresh от HTTP и персонального WebSocket.
    const error = await refreshSession(tokens!.accessToken, version, api);
    if (error) return { error };
    // Отмена потребителя не отменяет общий refresh, но исключает его HTTP-повтор.
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
