import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { needsTokenRefresh } from '@services/api/auth-error';

import {
  authSlice,
  sessionChecked,
  sessionEnded,
  sessionEstablished,
  sessionFailed,
} from './auth-slice';
import { createTestStorage } from './auth-test-utils';
import { clearTokens, readTokens, saveTokens } from './token-storage';

describe('правила доступа и хранения сессии', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([401, 403])(
    'обновляет токен только для авторизованных запросов пользователя/заказа (%s)',
    (status) => {
      const error = { status, data: { message: 'Любой текст' } };
      for (const endpoint of ['getCurrentUser', 'createOrder']) {
        expect(needsTokenRefresh(endpoint, 'Bearer test', error)).toBe(true);
        expect(needsTokenRefresh(endpoint, undefined, error)).toBe(false);
      }
      for (const endpoint of ['login', 'register', 'logout', 'getIngredients'])
        expect(needsTokenRefresh(endpoint, 'Bearer test', error)).toBe(false);
    }
  );

  it('не обновляет токен при сетевых, серверных ошибках и некорректном HTTP 200', () => {
    for (const status of [200, 400, 500])
      expect(
        needsTokenRefresh('getCurrentUser', 'Bearer test', { status, data: null })
      ).toBe(false);
    expect(
      needsTokenRefresh('getCurrentUser', 'Bearer test', {
        status: 'FETCH_ERROR',
        error: 'Ошибка',
      })
    ).toBe(false);
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

  it('не принимает результат старой сессии после выхода или смены пользователя', () => {
    const user = { name: 'Первый', email: 'first@example.test' };
    let state = authSlice.reducer(undefined, sessionEstablished(user));
    const previousVersion = state.version;
    state = authSlice.reducer(state, sessionEnded());
    state = authSlice.reducer(state, sessionChecked({ user, version: previousVersion }));
    expect(state.user).toBeNull();
    state = authSlice.reducer(
      state,
      sessionEstablished({ name: 'Второй', email: 'second@example.test' })
    );
    state = authSlice.reducer(
      state,
      sessionFailed({ version: previousVersion, message: 'Поздняя ошибка' })
    );
    expect(state.user?.name).toBe('Второй');
  });
});
