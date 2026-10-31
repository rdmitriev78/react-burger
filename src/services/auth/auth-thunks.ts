import { burgerApi } from '@services/api/burger-api';

import {
  checkingSession,
  logoutFinished,
  logoutStarted,
  selectAuth,
  sessionChecked,
  sessionEnded,
  sessionEstablished,
  sessionFailed,
} from './auth-slice';
import {
  clearTokens,
  readTokens,
  saveTokens,
  storageErrorMessage,
} from './token-storage';

import type { TAuthResponse } from './auth.types';
import type { AppThunk } from '@services/store';

export const establishSession =
  (response: TAuthResponse, version: number): AppThunk =>
  (dispatch, getState): void => {
    if (selectAuth(getState()).version !== version)
      throw new Error('Сессия уже изменилась');
    saveTokens(response);
    dispatch(sessionEstablished(response.user));
  };

export const checkSession =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState): Promise<void> => {
    const { version, status } = selectAuth(getState());
    if (status !== 'unknown' && status !== 'error') return;
    dispatch(checkingSession());
    try {
      let tokens;
      try {
        tokens = readTokens();
      } catch {
        throw new Error(storageErrorMessage);
      }
      if (!tokens) {
        dispatch(sessionEnded());
        return;
      }
      const request = dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(undefined, {
          forceRefetch: true,
          subscribe: false,
        })
      );
      try {
        const response = await request.unwrap();
        dispatch(sessionChecked({ user: response.user, version }));
      } finally {
        request.unsubscribe();
      }
    } catch (error: unknown) {
      dispatch(
        sessionFailed({
          version,
          message:
            error instanceof Error
              ? error.message
              : 'Не удалось проверить сессию. Повторите попытку.',
        })
      );
    }
  };

export const logout =
  (): AppThunk<Promise<boolean>> =>
  async (dispatch, getState): Promise<boolean> => {
    const { version, isLoggingOut, status } = selectAuth(getState());
    if (isLoggingOut || status !== 'authenticated') return false;
    dispatch(logoutStarted());
    let request:
      | ReturnType<ReturnType<typeof burgerApi.endpoints.logout.initiate>>
      | undefined;
    try {
      const tokens = readTokens();
      if (tokens) {
        request = dispatch(
          burgerApi.endpoints.logout.initiate({ token: tokens.refreshToken })
        );
        await request.unwrap();
      }
      if (selectAuth(getState()).version !== version) return false;
      clearTokens();
      dispatch(sessionEnded());
      return true;
    } finally {
      request?.reset();
      if (selectAuth(getState()).version === version) dispatch(logoutFinished());
    }
  };
