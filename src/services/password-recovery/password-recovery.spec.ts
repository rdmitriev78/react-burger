// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { burgerApi } from '@services/api/burger-api';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { createTestStore } from '@services/store-test-utils';

import {
  clearPasswordResetRequest,
  hasPasswordResetRequest,
  markPasswordResetRequested,
} from './password-recovery-storage';

import type { TPasswordRecoveryResponse } from './password-recovery.types';

const email = { email: 'recovery@example.test' };
const reset = { password: 'x', token: ' 00-AbC ' };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('API восстановления и флаг первого шага', () => {
  let app: ReturnType<typeof createTestStore>;
  let requests: Request[];
  let respond: () => Response;
  const send = (isReset: boolean): Promise<TPasswordRecoveryResponse> =>
    isReset
      ? app.dispatch(burgerApi.endpoints.resetPassword.initiate(reset)).unwrap()
      : app.dispatch(burgerApi.endpoints.requestPasswordReset.initiate(email)).unwrap();

  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    app = createTestStore();
    requests = [];
    respond = (): Response => json({ success: true, message: 'Любой успешный текст' });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        requests.push(new Request(input));
        return Promise.resolve(respond());
      })
    );
  });
  afterEach(() => {
    app.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe.each([false, true])('операция сброса: %s', (isReset) => {
    it('передаёт POST и точное тело без токена и не устанавливает сессию', async () => {
      localStorage.setItem('accessToken', 'Bearer existing');
      localStorage.setItem('refreshToken', 'existing-refresh');
      const auth = app.getState().auth;
      expect(await send(isReset)).toEqual({
        success: true,
        message: 'Любой успешный текст',
      });
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('POST');
      expect(new URL(requests[0].url).pathname).toBe(
        isReset ? '/api/password-reset/reset' : '/api/password-reset'
      );
      expect(requests[0].headers.get('authorization')).toBeNull();
      expect(await requests[0].json()).toEqual(isReset ? reset : email);
      expect(app.getState().auth).toEqual(auth);
      expect(localStorage.getItem('accessToken')).toBe('Bearer existing');
    });

    it.each([400, 401, 403, 500])(
      'не обновляет токены и не повторяет HTTP %s',
      async (status) => {
        localStorage.setItem('accessToken', 'Bearer existing');
        localStorage.setItem('refreshToken', 'existing-refresh');
        respond = (): Response => json({ success: false }, status);
        await expect(send(isReset)).rejects.toBeDefined();
        expect(requests).toHaveLength(1);
        expect(localStorage.getItem('refreshToken')).toBe('existing-refresh');
      }
    );

    it.each([
      null,
      { success: false, message: 'Отказ' },
      { success: true },
      { success: true, message: 123 },
    ])('отклоняет некорректный HTTP 200: %j', async (body) => {
      respond = (): Response => json(body);
      await expect(send(isReset)).rejects.toBeDefined();
      expect(requests).toHaveLength(1);
    });

    it('обрабатывает сетевую ошибку без повторов', async () => {
      respond = (): Response => {
        throw new TypeError('Offline');
      };
      await expect(send(isReset)).rejects.toBeDefined();
      expect(requests).toHaveLength(1);
    });
  });

  it('сохраняет только флаг и не затрагивает другие ключи', () => {
    localStorage.setItem('another-key', 'retained');
    expect(hasPasswordResetRequest()).toBe(false);
    markPasswordResetRequested();
    expect(hasPasswordResetRequest()).toBe(true);
    expect(localStorage.getItem('passwordResetRequested')).toBe('true');
    expect(localStorage.length).toBe(2);
    clearPasswordResetRequest();
    expect(hasPasswordResetRequest()).toBe(false);
    expect(localStorage.getItem('another-key')).toBe('retained');
  });

  it.each(['false', '1', '', 'TRUE'])('не принимает значение флага %j', (value) => {
    localStorage.setItem('passwordResetRequested', value);
    expect(hasPasswordResetRequest()).toBe(false);
  });

  it.each(['getItem', 'setItem', 'removeItem'] as const)(
    'передаёт ошибку %s вызывающей форме',
    (method) => {
      vi.spyOn(localStorage, method).mockImplementation(() => {
        throw new Error('Storage denied');
      });
      const operation = {
        getItem: hasPasswordResetRequest,
        setItem: markPasswordResetRequested,
        removeItem: clearPasswordResetRequest,
      }[method];
      expect(operation).toThrow('Storage denied');
    }
  );
});
