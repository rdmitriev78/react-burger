import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { needsTokenRefresh } from '@services/api/auth-error';

import {
  authSlice,
  checkingSession,
  logoutFinished,
  logoutStarted,
  profileSaveFinished,
  profileSaveStarted,
  sessionChecked,
  sessionEnded,
  sessionEstablished,
  sessionFailed,
  userUpdated,
} from './auth-slice';
import { createTestStorage } from './auth-test-utils';
import { clearTokens, readTokens, saveTokens } from './token-storage';

describe('правила доступа и хранения сессии', () => {
  it('обновляет профиль только при подтверждённой авторизации', () => {
    const user = { name: 'Тест', email: 'test@example.test' };
    const initial = authSlice.reducer(undefined, sessionEstablished(user));
    const updated = authSlice.reducer(initial, userUpdated({ ...user, name: 'Новое' }));
    expect(updated).toEqual({ ...initial, user: { ...user, name: 'Новое' } });
    const ended = authSlice.reducer(updated, sessionEnded());
    expect(authSlice.reducer(ended, userUpdated(user))).toBe(ended);
  });

  it('различает создание, подтверждение и завершение поколения сессии', () => {
    const user = { name: 'Тест', email: 'test@example.test' };
    let state = authSlice.reducer(undefined, checkingSession());
    const version = state.version;
    state = authSlice.reducer(state, sessionChecked(user));
    state = authSlice.reducer(state, userUpdated({ ...user, name: 'Новое' }));
    state = authSlice.reducer(state, sessionFailed('Нет сети'));
    state = authSlice.reducer(state, checkingSession());
    state = authSlice.reducer(state, sessionChecked(user));
    expect(state.version).toBe(version);
    state = authSlice.reducer(state, sessionEstablished(user));
    expect(state.version).toBe(version + 1);
    state = authSlice.reducer(state, sessionEnded());
    expect(state.version).toBe(version + 2);
    state = authSlice.reducer(state, sessionEstablished(user));
    expect(state.version).toBe(version + 3);
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('подтверждение пользователя сохраняет независимое ожидание операций', () => {
    const user = { name: 'Тест', email: 'test@example.test' };
    let state = authSlice.reducer(undefined, sessionEstablished(user));
    const version = state.version;
    state = authSlice.reducer(state, profileSaveStarted());
    state = authSlice.reducer(state, logoutStarted());
    state = authSlice.reducer(state, sessionChecked(user));
    expect(state).toMatchObject({ version, isSavingProfile: true, isLoggingOut: true });
    state = authSlice.reducer(state, profileSaveFinished());
    expect(state).toMatchObject({ version, isSavingProfile: false, isLoggingOut: true });
    state = authSlice.reducer(state, profileSaveStarted());
    state = authSlice.reducer(state, logoutFinished());
    expect(state).toMatchObject({ version, isSavingProfile: true, isLoggingOut: false });
  });

  it.each(['создание', 'завершение'])(
    '%s сессии сбрасывает ожидание прежних операций',
    (transition) => {
      const user = { name: 'Тест', email: 'test@example.test' };
      let state = authSlice.reducer(undefined, sessionEstablished(user));
      const version = state.version;
      state = authSlice.reducer(state, profileSaveStarted());
      state = authSlice.reducer(state, logoutStarted());
      state = authSlice.reducer(
        state,
        transition === 'создание' ? sessionEstablished(user) : sessionEnded()
      );
      expect(state).toMatchObject({
        version: version + 1,
        isSavingProfile: false,
        isLoggingOut: false,
      });
    }
  );

  it.each([401, 403])(
    'обновляет токен только при включённой политике и отправленном токене (%s)',
    (status) => {
      const error = { status, data: { message: 'Любой текст' } };
      expect(needsTokenRefresh(true, 'Bearer test', error)).toBe(true);
      expect(needsTokenRefresh(true, undefined, error)).toBe(false);
      expect(needsTokenRefresh(false, 'Bearer test', error)).toBe(false);
      expect(needsTokenRefresh(false, undefined, error)).toBe(false);
    }
  );

  it('не обновляет токен при сетевых, серверных ошибках и некорректном HTTP 200', () => {
    for (const status of [200, 400, 500])
      expect(needsTokenRefresh(true, 'Bearer test', { status, data: null })).toBe(false);
    expect(
      needsTokenRefresh(true, 'Bearer test', {
        status: 'FETCH_ERROR',
        error: 'Ошибка',
      })
    ).toBe(false);
    expect(needsTokenRefresh(true, 'Bearer test', undefined)).toBe(false);
  });

  it('сохраняет только пару токенов и очищает неполную пару', () => {
    expect(readTokens()).toBeNull();
    saveTokens({ accessToken: 'Bearer test', refreshToken: 'refresh' });
    expect(readTokens()).toEqual({
      accessToken: 'Bearer test',
      refreshToken: 'refresh',
    });
    expect(localStorage.length).toBe(2);
    localStorage.removeItem('refreshToken');
    expect(readTokens()).toBeNull();
    expect(localStorage.length).toBe(0);
    saveTokens({ accessToken: 'Bearer test', refreshToken: 'refresh' });
    clearTokens();
    expect(readTokens()).toBeNull();
  });

  it('убирает частичную запись при отказе хранилища', () => {
    const original = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'refreshToken') throw new Error('Denied');
      original(key, value);
    });
    expect(() =>
      saveTokens({ accessToken: 'Bearer test', refreshToken: 'refresh' })
    ).toThrow();
    expect(localStorage.length).toBe(0);
  });

  it('сообщает об ошибке чтения недоступного хранилища', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    expect(readTokens).toThrow('Denied');
  });

  it('различает ошибку проверки и гостя, повтор подтверждает пользователя', () => {
    const user = { name: 'Тест', email: 'test@example.test' };
    let state = authSlice.reducer(undefined, checkingSession());
    expect(state.status).toBe('checking');
    state = authSlice.reducer(state, sessionFailed('Нет сети'));
    expect(state).toMatchObject({
      version: 0,
      status: 'error',
      user: null,
      message: 'Нет сети',
    });
    state = authSlice.reducer(state, checkingSession());
    expect(state.message).toBe('');
    state = authSlice.reducer(state, sessionChecked(user));
    expect(state).toMatchObject({
      version: 0,
      status: 'authenticated',
      user,
      message: '',
    });
    state = authSlice.reducer(state, sessionEnded());
    expect(state).toMatchObject({
      version: 1,
      status: 'anonymous',
      user: null,
      message: '',
    });
  });
});
