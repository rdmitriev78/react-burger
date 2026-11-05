import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

export const isAccessDenied = (error: FetchBaseQueryError | undefined): boolean =>
  error?.status === 401 || error?.status === 403;

// Рабочий контракт API: refresh применим только к запросам с access-токеном.
export const needsTokenRefresh = (
  authorized: boolean,
  accessToken: string | undefined,
  error: FetchBaseQueryError | undefined
): boolean => authorized && Boolean(accessToken) && isAccessDenied(error);
