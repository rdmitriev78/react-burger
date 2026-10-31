import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { needsTokenRefresh } from '@services/api/auth-error';

import {
  authSlice,
  sessionChecked,
  sessionEnded,
  sessionEstablished,
  sessionFailed,
  userUpdated,
} from './auth-slice';
import { createTestStorage } from './auth-test-utils';
import { clearTokens, readTokens, saveTokens } from './token-storage';

describe('правила доступа и хранения сессии', () => {
  it('обновляет только пользователя действующей сессии', () => {
    const user = { name: 'Тест', email: 'test@example.test' };
    const initial = authSlice.reducer(undefined, sessionEstablished(user));
    const updated = authSlice.reducer(
      initial,
      userUpdated({ user: { ...user, name: 'Новое' }, version: initial.version })
    );
    expect(updated).toEqual({ ...initial, user: { ...user, name: 'Новое' } });
    expect(
      authSlice.reducer(initial, userUpdated({ user, version: initial.version - 1 }))
    ).toBe(initial);
    const ended = authSlice.reducer(updated, sessionEnded());
    expect(authSlice.reducer(ended, userUpdated({ user, version: ended.version }))).toBe(
      ended
    );
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

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
