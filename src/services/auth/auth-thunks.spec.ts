// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { burgerApi } from '@services/api/burger-api';
import {
  sessionEnded,
  sessionEstablished,
  sessionFailed,
} from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import {
  checkSession,
  establishSession,
  logout,
  saveProfile,
} from '@services/auth/auth-thunks';
import {
  readTokens,
  saveTokens,
  storageErrorMessage,
} from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

const user = { name: 'Тест', email: 'test@example.test' };

const tokens = { accessToken: 'Bearer old', refreshToken: 'old-refresh' };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('Прикладные операции авторизации', () => {
  let app: ReturnType<typeof createTestStore>;
  let requests: Request[];
  let respond: (request: Request) => Response | Promise<Response>;
  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    app = createTestStore();
    requests = [];
    respond = (): Response | Promise<Response> => json({ success: true, user });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const request = new Request(input);
        requests.push(request);
        return respond(request);
      })
    );
  });
  afterEach(() => {
    app.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('проверяет сессию один раз, включая повторный запуск из StrictMode', async () => {
    saveTokens(tokens);
    const version = app.getState().auth.version;
    await Promise.all([app.dispatch(checkSession()), app.dispatch(checkSession())]);
    expect(requests).toHaveLength(1);
    expect(app.getState().auth.user).toEqual(user);
    expect(app.getState().auth.version).toBe(version);
    expect(requests[0].headers.get('authorization')).toBe(tokens.accessToken);
  });

  it('не запрашивает пользователя без токенов или при неполной паре', async () => {
    localStorage.setItem('accessToken', tokens.accessToken);
    await app.dispatch(checkSession());
    expect(requests).toHaveLength(0);
    expect(readTokens()).toBeNull();
    expect(app.getState().auth.status).toBe('anonymous');
  });

  it('показывает ошибку проверки при недоступном хранилище', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    await app.dispatch(checkSession());
    expect(app.getState().auth.status).toBe('error');
    expect(app.getState().auth.user).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('повторяет проверку после сети и не использует данные прошлого пользователя', async () => {
    saveTokens(tokens);
    respond = (): Response | Promise<Response> => {
      throw new TypeError('Offline');
    };
    await app.dispatch(checkSession());
    expect(app.getState().auth.status).toBe('error');
    respond = (): Response | Promise<Response> => json({ success: true, user });
    await app.dispatch(checkSession());
    expect(app.getState().auth.user).toEqual(user);
    app.dispatch(sessionEnded());
    app.dispatch(sessionEstablished({ ...user, name: 'Другой' }));
    expect(app.getState().auth.user?.name).toBe('Другой');
  });

  it.each([200, 401, 500])(
    'игнорирует позднюю проверку прежней сессии (%s)',
    async (status) => {
      saveTokens(tokens);
      let release!: (response: Response) => void;
      respond = (): Response | Promise<Response> =>
        new Promise<Response>((resolve) => {
          release = resolve;
        });
      const checking = app.dispatch(checkSession());
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      app.dispatch(sessionEnded());
      const other = { name: 'Другой', email: 'other@example.test' };
      const otherTokens = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
      saveTokens(otherTokens);
      app.dispatch(sessionEstablished(other));
      release(json({ success: true, user }, status));
      await checking;
      expect(app.getState().auth).toMatchObject({
        status: 'authenticated',
        user: other,
      });
      expect(readTokens()).toEqual(otherTokens);
      expect(requests).toHaveLength(1);
    }
  );

  it('новая проверка не присоединяется к ожидающей проверке прошлого поколения', async () => {
    saveTokens(tokens);
    let release!: (response: Response) => void;
    const other = { name: 'Другой', email: 'other@example.test' };
    respond = (request): Response | Promise<Response> =>
      request.headers.get('authorization') === tokens.accessToken
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : json({ success: true, user: other });
    const old = app.dispatch(checkSession());
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    app.dispatch(sessionEnded());
    saveTokens({ accessToken: 'Bearer other', refreshToken: 'other-refresh' });
    app.dispatch(sessionFailed('Повтор проверки'));
    await app.dispatch(checkSession());
    expect(requests).toHaveLength(2);
    expect(app.getState().auth.user).toEqual(other);
    release(json({ success: true, user }));
    await old;
    expect(app.getState().auth.user).toEqual(other);
  });
  it('saveProfile возвращает подтверждённого пользователя после обновления auth', async () => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    const version = app.getState().auth.version;
    const confirmed = { name: 'Подтверждённое', email: 'canonical@example.test' };
    respond = (): Response => json({ success: true, user: confirmed });
    expect(await app.dispatch(saveProfile({ ...user, password: 'x' }))).toEqual(
      confirmed
    );
    expect(app.getState().auth).toMatchObject({
      user: confirmed,
      version,
      status: 'authenticated',
      isSavingProfile: false,
    });
    expect(readTokens()).toEqual(tokens);
    expect(Object.keys(app.getState().burgerApi.mutations)).toHaveLength(0);
  });

  it('ошибка saveProfile сохраняет пользователя и разрешает ручной повтор', async () => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    const before = app.getState().auth;
    respond = (): Response => json({}, 500);
    await expect(
      app.dispatch(saveProfile({ ...user, password: '' }))
    ).rejects.toBeDefined();
    expect(app.getState().auth).toEqual(before);
    const confirmed = { ...user, name: 'Повтор' };
    respond = (): Response => json({ success: true, user: confirmed });
    expect(await app.dispatch(saveProfile({ ...user, password: '' }))).toEqual(
      confirmed
    );
    expect(app.getState().auth.user).toEqual(confirmed);
    expect(app.getState().auth.isSavingProfile).toBe(false);
  });

  it('saveProfile сохраняет ожидание общей операции и не запускает дубль', async () => {
    expect(await app.dispatch(saveProfile({ ...user, password: '' }))).toBeUndefined();
    expect(requests).toHaveLength(0);
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    const pending = deferred<Response>();
    respond = (): Promise<Response> => pending.promise;
    const saving = app.dispatch(saveProfile({ ...user, password: '' }));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(app.getState().auth.isSavingProfile).toBe(true);
    expect(await app.dispatch(saveProfile({ ...user, password: '' }))).toBeUndefined();
    expect(requests).toHaveLength(1);
    pending.resolve(json({ success: true, user }));
    await saving;
    respond = (): Response => json({ success: true, user });
    await app.dispatch(saveProfile({ ...user, password: '' }));
    expect(requests).toHaveLength(2);
    expect(app.getState().auth.isSavingProfile).toBe(false);
  });

  it.each([200, 500])(
    'старый saveProfile не меняет пользователя и pending новой операции (%s)',
    async (status) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      const oldResponse = deferred<Response>();
      const newResponse = deferred<Response>();
      respond = (request): Promise<Response> =>
        request.headers.get('authorization') === tokens.accessToken
          ? oldResponse.promise
          : newResponse.promise;
      const old = app.dispatch(saveProfile({ ...user, password: 'old' }));
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      app.dispatch(sessionEnded());
      const other = { name: 'Другой', email: 'other@example.test' };
      const pair = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
      saveTokens(pair);
      app.dispatch(sessionEstablished(other));
      const confirmed = { ...other, name: 'Новый черновик' };
      const current = app.dispatch(saveProfile({ ...confirmed, password: '' }));
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      oldResponse.resolve(json({ success: true, user }, status));
      expect(await old).toBeUndefined();
      expect(app.getState().auth).toMatchObject({ user: other, isSavingProfile: true });
      expect(readTokens()).toEqual(pair);
      expect(requests.map((r) => r.headers.get('authorization'))).toEqual([
        tokens.accessToken,
        pair.accessToken,
      ]);
      expect(await requests[0].json()).toEqual({ ...user, password: 'old' });
      expect(await requests[1].json()).toEqual({ ...confirmed, password: '' });
      newResponse.resolve(json({ success: true, user: confirmed }));
      expect(await current).toEqual(confirmed);
      expect(app.getState().auth).toMatchObject({
        user: confirmed,
        isSavingProfile: false,
      });
      expect(Object.keys(app.getState().burgerApi.mutations)).toHaveLength(0);
    }
  );

  it('logout очищает пару и завершает сессию до возврата true', async () => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    const version = app.getState().auth.version;
    respond = (): Response => json({ success: true, message: 'Successful logout' });
    expect(await app.dispatch(logout())).toBe(true);
    expect(readTokens()).toBeNull();
    expect(app.getState().auth).toMatchObject({
      version: version + 1,
      status: 'anonymous',
      user: null,
      isLoggingOut: false,
    });
    expect(await requests[0].json()).toEqual({ token: tokens.refreshToken });
    expect(Object.keys(app.getState().burgerApi.mutations)).toHaveLength(0);
  });

  it.each(['none', 'access', 'refresh'])(
    'logout завершает локальную сессию без HTTP при неполной паре: %s',
    async (stored) => {
      app.dispatch(sessionEstablished(user));
      if (stored === 'access') localStorage.setItem('accessToken', tokens.accessToken);
      if (stored === 'refresh')
        localStorage.setItem('refreshToken', tokens.refreshToken);
      expect(await app.dispatch(logout())).toBe(true);
      expect(requests).toHaveLength(0);
      expect(localStorage.length).toBe(0);
      expect(app.getState().auth).toMatchObject({
        status: 'anonymous',
        isLoggingOut: false,
      });
    }
  );

  it('logout сохраняет pending до ответа и не запускает параллельный дубль', async () => {
    expect(await app.dispatch(logout())).toBe(false);
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    const pending = deferred<Response>();
    respond = (): Promise<Response> => pending.promise;
    const loggingOut = app.dispatch(logout());
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(app.getState().auth.isLoggingOut).toBe(true);
    expect(readTokens()).toEqual(tokens);
    expect(await app.dispatch(logout())).toBe(false);
    expect(requests).toHaveLength(1);
    pending.resolve(json({ success: true, message: 'Successful logout' }));
    expect(await loggingOut).toBe(true);
    expect(app.getState().auth.isLoggingOut).toBe(false);
  });

  it.each(['read', 'clear'])(
    'ошибка storage %s не подтверждает logout и разрешает повтор',
    async (stage) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      const before = app.getState().auth;
      respond = (): Response => json({ success: true, message: 'Successful logout' });
      const storage = vi
        .spyOn(localStorage, stage === 'read' ? 'getItem' : 'removeItem')
        .mockImplementation(() => {
          throw new Error('Denied');
        });
      await expect(app.dispatch(logout())).rejects.toThrow('Denied');
      expect(app.getState().auth).toEqual(before);
      expect(requests).toHaveLength(stage === 'read' ? 0 : 1);
      storage.mockRestore();
      expect(readTokens()).toEqual(tokens);
      expect(await app.dispatch(logout())).toBe(true);
      expect(readTokens()).toBeNull();
      expect(app.getState().auth.isLoggingOut).toBe(false);
    }
  );

  it.each(['http', 'malformed', 'network'])(
    'ошибка logout %s сохраняет сессию и разрешает новую попытку',
    async (failure) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      const before = app.getState().auth;
      respond = (): Response => {
        if (failure === 'network') throw new TypeError('Offline');
        return failure === 'http' ? json({}, 500) : json({ success: true });
      };
      await expect(app.dispatch(logout())).rejects.toBeDefined();
      expect(app.getState().auth).toEqual(before);
      expect(readTokens()).toEqual(tokens);
      respond = (): Response => json({ success: true, message: 'Successful logout' });
      expect(await app.dispatch(logout())).toBe(true);
      expect(requests).toHaveLength(2);
      expect(readTokens()).toBeNull();
    }
  );

  it.each([200, 500])(
    'поздний logout не меняет новую пару и pending выхода B (%s)',
    async (status) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      const oldResponse = deferred<Response>();
      const newResponse = deferred<Response>();
      respond = (request): Promise<Response> =>
        requests.indexOf(request) === 0 ? oldResponse.promise : newResponse.promise;
      const old = app.dispatch(logout());
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      app.dispatch(sessionEnded());
      const other = { name: 'Другой', email: 'other@example.test' };
      const pair = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
      saveTokens(pair);
      app.dispatch(sessionEstablished(other));
      const current = app.dispatch(logout());
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      oldResponse.resolve(json({ success: true, message: 'Successful logout' }, status));
      expect(await old).toBe(false);
      expect(app.getState().auth).toMatchObject({ user: other, isLoggingOut: true });
      expect(readTokens()).toEqual(pair);
      expect(await requests[0].json()).toEqual({ token: tokens.refreshToken });
      expect(await requests[1].json()).toEqual({ token: pair.refreshToken });
      newResponse.resolve(json({ success: true, message: 'Successful logout' }));
      expect(await current).toBe(true);
      expect(readTokens()).toBeNull();
      expect(app.getState().auth).toMatchObject({
        status: 'anonymous',
        isLoggingOut: false,
      });
      expect(Object.keys(app.getState().burgerApi.mutations)).toHaveLength(0);
    }
  );

  it('establishSession сохраняет пару и создаёт ровно одно новое поколение', () => {
    app.dispatch(sessionEnded());
    const version = app.getState().auth.version;
    expect(
      app.dispatch(establishSession({ success: true, user, ...tokens }, version))
    ).toBe(true);
    expect(readTokens()).toEqual(tokens);
    expect(app.getState().auth).toMatchObject({
      version: version + 1,
      status: 'authenticated',
      user,
      isSavingProfile: false,
      isLoggingOut: false,
    });
    expect(requests).toHaveLength(0);
  });

  it('устаревший establishSession не записывает пару и не меняет поколение', () => {
    const oldVersion = app.getState().auth.version;
    const other = { name: 'Другой', email: 'other@example.test' };
    const pair = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
    saveTokens(pair);
    app.dispatch(sessionEstablished(other));
    const before = app.getState().auth;
    expect(
      app.dispatch(establishSession({ success: true, user, ...tokens }, oldVersion))
    ).toBe(false);
    expect(readTokens()).toEqual(pair);
    expect(app.getState().auth).toEqual(before);
  });

  it.each(['accessToken', 'refreshToken'])(
    'отказ записи %s не создаёт поколение и разрешает повтор establishSession',
    (key) => {
      app.dispatch(sessionEnded());
      const before = app.getState().auth;
      const setItem = localStorage.setItem.bind(localStorage);
      const storage = vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation((name, value) => {
          if (name === key) throw new Error('Denied');
          setItem(name, value);
        });
      const response = { success: true as const, user, ...tokens };
      expect(() => app.dispatch(establishSession(response, before.version))).toThrow(
        storageErrorMessage
      );
      expect(app.getState().auth).toEqual(before);
      expect(readTokens()).toBeNull();
      storage.mockRestore();
      expect(app.dispatch(establishSession(response, before.version))).toBe(true);
      expect(app.getState().auth.version).toBe(before.version + 1);
    }
  );
});
