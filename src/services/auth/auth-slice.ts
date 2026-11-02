import { createSlice } from '@reduxjs/toolkit';

import type { TUser } from './auth.types';
import type { PayloadAction } from '@reduxjs/toolkit';

type TAuthState = {
  status: 'unknown' | 'checking' | 'authenticated' | 'anonymous' | 'error';
  user: TUser | null;
  // Новая авторизация и завершение меняют поколение: старые ответы не применяются.
  // Подтверждение текущего пользователя, сохранение профиля и refresh его не меняют.
  version: number;
  message: string;
  isSavingProfile: boolean;
  isLoggingOut: boolean;
};

export const authSlice = createSlice({
  name: 'auth',
  initialState: (): TAuthState => ({
    status: 'unknown',
    user: null,
    version: 0,
    message: '',
    isSavingProfile: false,
    isLoggingOut: false,
  }),
  reducers: {
    checkingSession: (state): void => {
      state.status = 'checking';
      state.message = '';
    },
    sessionChecked: (state, { payload }: PayloadAction<TUser>): void => {
      state.status = 'authenticated';
      state.user = payload;
      state.message = '';
    },
    sessionEstablished: (state, { payload }: PayloadAction<TUser>): void => {
      state.version += 1;
      state.status = 'authenticated';
      state.user = payload;
      state.message = '';
      state.isSavingProfile = false;
      state.isLoggingOut = false;
    },
    userUpdated: (state, { payload }: PayloadAction<TUser>): void => {
      if (state.status === 'authenticated') state.user = payload;
    },
    sessionEnded: (state): void => {
      state.version += 1;
      state.status = 'anonymous';
      state.user = null;
      state.message = '';
      state.isSavingProfile = false;
      state.isLoggingOut = false;
    },
    sessionFailed: (state, { payload }: PayloadAction<string>): void => {
      state.status = 'error';
      state.user = null;
      state.message = payload;
    },
    profileSaveStarted: (state): void => {
      state.isSavingProfile = true;
    },
    profileSaveFinished: (state): void => {
      state.isSavingProfile = false;
    },
    logoutStarted: (state): void => {
      state.isLoggingOut = true;
    },
    logoutFinished: (state): void => {
      state.isLoggingOut = false;
    },
  },
  selectors: {
    selectAuth: (state): TAuthState => state,
    selectSessionVersion: (state): number => state.version,
  },
});

export const {
  checkingSession,
  sessionChecked,
  sessionEstablished,
  sessionEnded,
  sessionFailed,
  userUpdated,
  profileSaveStarted,
  profileSaveFinished,
  logoutStarted,
  logoutFinished,
} = authSlice.actions;
export const { selectAuth, selectSessionVersion } = authSlice.selectors;
