import { burgerApi } from '@services/api/burger-api';

import {
  checkingSession,
  logoutFinished,
  logoutStarted,
  profileSaveFinished,
  profileSaveStarted,
  selectAuth,
  selectSessionVersion,
  sessionChecked,
  sessionEnded,
  sessionEstablished,
  sessionFailed,
  userUpdated,
} from './auth-slice';
import {
  clearTokens,
  readTokens,
  saveTokens,
  storageErrorMessage,
} from './token-storage';

import type { TAuthResponse, TUser, TUserUpdate } from './auth.types';
import type { AppThunk } from '@services/store';

export const establishSession =
  (response: TAuthResponse, version: number): AppThunk<boolean> =>
  (dispatch, getState): boolean => {
    if (selectSessionVersion(getState()) !== version) return false;
    saveTokens(response);
    dispatch(sessionEstablished(response.user));
    return true;
  };

export const saveProfile =
  (values: TUserUpdate): AppThunk<Promise<TUser | undefined>> =>
  async (dispatch, getState): Promise<TUser | undefined> => {
    const { version, status, isSavingProfile } = selectAuth(getState());
    if (status !== 'authenticated' || isSavingProfile) return;
    dispatch(profileSaveStarted());
    // Сохранение принадлежит сессии и продолжается после ухода со страницы.
    const request = dispatch(burgerApi.endpoints.updateCurrentUser.initiate(values));
    try {
      const response = await request.unwrap();
      if (selectSessionVersion(getState()) !== version) return;
      const user = { name: response.user.name, email: response.user.email };
      dispatch(userUpdated(user));
      return user;
    } catch (error: unknown) {
      if (selectSessionVersion(getState()) !== version) return;
      throw error;
    } finally {
      request.reset();
      // Старое завершение не снимает ожидание сохранения нового пользователя.
      if (selectSessionVersion(getState()) === version) dispatch(profileSaveFinished());
    }
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
        burgerApi.endpoints.getCurrentUser.initiate(version, {
          forceRefetch: true,
          subscribe: false,
        })
      );
      const response = await request.unwrap();
      if (selectSessionVersion(getState()) !== version) return;
      dispatch(sessionChecked(response.user));
    } catch (error: unknown) {
      // Транспорт уже мог подтвердить выход или сообщить об ошибке хранилища.
      if (
        selectSessionVersion(getState()) !== version ||
        selectAuth(getState()).status !== 'checking'
      )
        return;
      dispatch(
        sessionFailed(
          error instanceof Error
            ? error.message
            : 'Не удалось проверить сессию. Повторите попытку.'
        )
      );
    }
  };

export const logout =
  (): AppThunk<Promise<boolean>> =>
  async (dispatch, getState): Promise<boolean> => {
    const { version, isLoggingOut, status } = selectAuth(getState());
    if (isLoggingOut || status !== 'authenticated') return false;
    dispatch(logoutStarted());
    try {
      const tokens = readTokens();
      if (tokens) {
        const request = dispatch(
          burgerApi.endpoints.logout.initiate({ token: tokens.refreshToken })
        );
        try {
          await request.unwrap();
        } finally {
          request.reset();
        }
      }
      if (selectSessionVersion(getState()) !== version) return false;
      clearTokens();
      dispatch(sessionEnded());
      return true;
    } catch (error: unknown) {
      if (selectSessionVersion(getState()) !== version) return false;
      throw error;
    } finally {
      // Успешный sessionEnded уже сбросил флаги и сменил поколение.
      if (selectSessionVersion(getState()) === version) dispatch(logoutFinished());
    }
  };
