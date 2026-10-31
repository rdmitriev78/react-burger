import { createSlice } from '@reduxjs/toolkit';

import type { TUser } from './auth.types';
import type { PayloadAction } from '@reduxjs/toolkit';

type TAuthState = {
  status: 'unknown' | 'checking' | 'authenticated' | 'anonymous' | 'error';
  user: TUser | null;
  // Поколение сессии: меняется при её установке и завершении, но не при refresh.
  // Асинхронные операции сравнивают сохранённую версию с текущей,
  // чтобы запоздавший результат не изменил уже сменившуюся сессию.
  version: number;
  message: string;
  isLoggingOut: boolean;
};

export const authSlice = createSlice({
  name: 'auth',
  initialState: (): TAuthState => ({
    status: 'unknown',
    user: null,
    version: 0,
    message: '',
    isLoggingOut: false,
  }),
  reducers: {
    checkingSession: (state): void => {
      state.status = 'checking';
      state.message = '';
    },
    sessionChecked: (
      state,
      { payload }: PayloadAction<{ user: TUser; version: number }>
    ): void => {
      if (state.version !== payload.version) return;
      state.status = 'authenticated';
      state.user = payload.user;
      state.message = '';
    },
    sessionEstablished: (state, { payload }: PayloadAction<TUser>): void => {
      state.version += 1;
      state.status = 'authenticated';
      state.user = payload;
      state.message = '';
      state.isLoggingOut = false;
    },
    userUpdated: (
      state,
      { payload }: PayloadAction<{ user: TUser; version: number }>
    ): void => {
      // Сохранение профиля не создаёт сессию и не принимает ответ прежнего пользователя.
      if (state.version !== payload.version || state.status !== 'authenticated') return;
      state.user = payload.user;
    },
    sessionEnded: (state): void => {
      state.version += 1;
      state.status = 'anonymous';
      state.user = null;
      state.message = '';
      state.isLoggingOut = false;
    },
    sessionFailed: (
      state,
      { payload }: PayloadAction<{ message: string; version: number }>
    ): void => {
      if (state.version !== payload.version) return;
      state.status = 'error';
      state.user = null;
      state.message = payload.message;
    },
    logoutStarted: (state): void => {
      state.isLoggingOut = true;
    },
    logoutFinished: (state): void => {
      state.isLoggingOut = false;
    },
  },
  selectors: { selectAuth: (state): TAuthState => state },
});

export const {
  checkingSession,
  sessionChecked,
  sessionEstablished,
  sessionEnded,
  sessionFailed,
  userUpdated,
  logoutStarted,
  logoutFinished,
} = authSlice.actions;
export const { selectAuth } = authSlice.selectors;
