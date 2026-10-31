// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { burgerApi } from '@services/api/burger-api';
import { createTestStore } from '@services/store-test-utils';

import { sessionEnded, sessionEstablished } from './auth-slice';
import { createTestStorage } from './auth-test-utils';
import { checkSession, establishSession, logout } from './auth-thunks';
import { clearTokens, readTokens, saveTokens } from './token-storage';

const user = { name: 'Тест', email: 'test@example.test' };
const tokens = { accessToken: 'Bearer old', refreshToken: 'old-refresh' };
const renewed = { accessToken: 'Bearer new', refreshToken: 'new-refresh' };
const authResponse = { success: true as const, user, ...tokens };
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

describe('API и жизненный цикл сессии', () => {
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

  it('вход и регистрация используют правильные методы, тела и не запускают refresh', async () => {
    respond = (): Response | Promise<Response> => json(authResponse);
    await app
      .dispatch(
        burgerApi.endpoints.login.initiate({
          email: user.email,
          password: 'test-password',
        })
      )
      .unwrap();
    await app
      .dispatch(
        burgerApi.endpoints.register.initiate({ ...user, password: 'test-password' })
      )
      .unwrap();
    expect(
      requests.map((r) => [
        new URL(r.url).pathname,
        r.method,
        r.headers.get('authorization'),
      ])
    ).toEqual([
      ['/api/auth/login', 'POST', null],
      ['/api/auth/register', 'POST', null],
    ]);
    expect(await requests[0].json()).toEqual({
      email: user.email,
      password: 'test-password',
    });
    expect(await requests[1].json()).toEqual({ ...user, password: 'test-password' });
    respond = (): Response | Promise<Response> => json({ message: 'Отказ' }, 401);
    await expect(
      app
        .dispatch(
          burgerApi.endpoints.login.initiate({ email: user.email, password: 'wrong' })
        )
        .unwrap()
    ).rejects.toBeDefined();
    expect(requests).toHaveLength(3);
  });

  it.each([
    { success: false },
    { success: true, user },
    { ...authResponse, accessToken: 'bad-token' },
  ])('отклоняет неправильный ответ входа %j', async (body) => {
    respond = (): Response | Promise<Response> => json(body);
    await expect(
      app
        .dispatch(
          burgerApi.endpoints.login.initiate({
            email: user.email,
            password: 'test-password',
          })
        )
        .unwrap()
    ).rejects.toBeDefined();
    expect(readTokens()).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it('передаёт токен с заказом и сохраняет гостевой запрос без токена', async () => {
    respond = (): Response | Promise<Response> =>
      json({ success: true, name: 'Бургер', order: { number: 12 } });
    const body = { ingredients: ['bun', 'filling', 'bun'] };
    await app.dispatch(burgerApi.endpoints.createOrder.initiate(body)).unwrap();
    saveTokens(tokens);
    await app.dispatch(burgerApi.endpoints.createOrder.initiate(body)).unwrap();
    expect(requests.map((r) => r.headers.get('authorization'))).toEqual([
      null,
      tokens.accessToken,
    ]);
    expect(await requests[1].json()).toEqual(body);
  });

  it('обновляет оба токена и однократно повторяет исходный запрос заказа', async () => {
    saveTokens(tokens);
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token')
        ? json({ success: true, ...renewed })
        : request.headers.get('authorization') === tokens.accessToken
          ? json({ message: 'Любой текст' }, 403)
          : json({ success: true, name: 'Бургер', order: { number: 12 } });
    const body = { ingredients: ['bun', 'filling', 'filling', 'bun'] };
    await app.dispatch(burgerApi.endpoints.createOrder.initiate(body)).unwrap();
    expect(requests).toHaveLength(3);
    expect(await requests[1].json()).toEqual({ token: tokens.refreshToken });
    expect(requests[1].headers.get('authorization')).toBeNull();
    expect(await requests[2].json()).toEqual(body);
    expect(requests[2].headers.get('authorization')).toBe(renewed.accessToken);
    expect(readTokens()).toEqual(renewed);
  });

  it.each([401, 403])('очищает сессию при отказе refresh (%s)', async (status) => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    respond = (): Response | Promise<Response> => json({ message: 'Отказ' }, status);
    await expect(
      app.dispatch(burgerApi.endpoints.getCurrentUser.initiate()).unwrap()
    ).rejects.toBeDefined();
    expect(requests).toHaveLength(2);
    expect(readTokens()).toBeNull();
    expect(app.getState().auth.status).toBe('anonymous');
  });

  it('не зацикливает обновление после повторного отказа', async () => {
    saveTokens(tokens);
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token')
        ? json({ success: true, ...renewed })
        : json({}, 401);
    await expect(
      app.dispatch(burgerApi.endpoints.getCurrentUser.initiate()).unwrap()
    ).rejects.toBeDefined();
    expect(requests).toHaveLength(3);
    expect(readTokens()).toBeNull();
  });

  it.each(['network', 'server', 'invalid'] as const)(
    'сохраняет токены при временной ошибке refresh: %s',
    async (kind) => {
      saveTokens(tokens);
      respond = (request): Response | Promise<Response> => {
        if (!request.url.endsWith('auth/token')) return json({}, 401);
        if (kind === 'network') throw new TypeError('Offline');
        return kind === 'server' ? json({}, 503) : json({ success: false });
      };
      await app.dispatch(checkSession());
      expect(readTokens()).toEqual(tokens);
      expect(app.getState().auth.status).toBe('error');
      expect(requests).toHaveLength(2);
    }
  );

  it('не делает refresh/повтор при обычной ошибке заказа или гостевом 401', async () => {
    for (const status of [401, 500, 200]) {
      respond = (): Response | Promise<Response> => json({ success: false }, status);
      await expect(
        app
          .dispatch(burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] }))
          .unwrap()
      ).rejects.toBeDefined();
    }
    expect(requests).toHaveLength(3);
  });

  it('проверяет сессию один раз, включая повторный запуск из StrictMode', async () => {
    saveTokens(tokens);
    await Promise.all([app.dispatch(checkSession()), app.dispatch(checkSession())]);
    expect(requests).toHaveLength(1);
    expect(app.getState().auth.user).toEqual(user);
    expect(requests[0].headers.get('authorization')).toBe(tokens.accessToken);
  });

  it('не запрашивает пользователя без токенов или при неполной паре', async () => {
    localStorage.setItem('accessToken', tokens.accessToken);
    await app.dispatch(checkSession());
    expect(requests).toHaveLength(0);
    expect(readTokens()).toBeNull();
    expect(app.getState().auth.status).toBe('anonymous');
  });

  it('не отменяет публичный каталог при смене поколения сессии', async () => {
    const loading = deferred<Response>();
    respond = (): Promise<Response> => loading.promise;
    const query = app.dispatch(burgerApi.endpoints.getIngredients.initiate());
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    app.dispatch(sessionEstablished(user));
    loading.resolve(
      json({
        success: true,
        data: [
          {
            _id: 'fixture',
            name: 'Булка',
            type: 'bun',
            price: 100,
            proteins: 1,
            fat: 1,
            carbohydrates: 1,
            calories: 100,
            image: '',
            image_mobile: '',
            image_large: '',
          },
        ],
      })
    );
    expect(await query.unwrap()).toHaveLength(1);
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
    app.dispatch(
      establishSession(
        { ...authResponse, user: { ...user, name: 'Другой' } },
        app.getState().auth.version
      )
    );
    expect(app.getState().auth.user?.name).toBe('Другой');
  });

  it('не подтверждает вход при ошибке записи localStorage', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    expect(() => app.dispatch(establishSession(authResponse, 0))).toThrow();
    expect(app.getState().auth.status).toBe('unknown');
  });

  it('выход использует refresh-токен, блокирует дубликаты и очищает сессию', async () => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    respond = (): Response | Promise<Response> =>
      json({ success: true, message: 'Successful logout' });
    const results = await Promise.all([app.dispatch(logout()), app.dispatch(logout())]);
    expect(results).toEqual([true, false]);
    expect(requests).toHaveLength(1);
    expect(await requests[0].json()).toEqual({ token: tokens.refreshToken });
    expect(readTokens()).toBeNull();
    expect(app.getState().auth.user).toBeNull();
  });

  it('сохраняет сессию и позволяет повтор при ошибке выхода', async () => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    respond = (): Response | Promise<Response> => json({}, 403);
    await expect(app.dispatch(logout())).rejects.toBeDefined();
    expect(requests).toHaveLength(1);
    expect(readTokens()).toEqual(tokens);
    expect(app.getState().auth.isLoggingOut).toBe(false);
    expect(app.getState().auth.status).toBe('authenticated');
    respond = (): Response | Promise<Response> =>
      json({ success: true, message: 'Successful logout' });
    expect(await app.dispatch(logout())).toBe(true);
  });

  it('объединяет refresh, а отмена заказа не мешает проверке пользователя', async () => {
    saveTokens(tokens);
    const refreshing = deferred<Response>();
    respond = (request): Response | Promise<Response> => {
      if (request.url.endsWith('auth/token')) return refreshing.promise;
      if (request.headers.get('authorization') === tokens.accessToken)
        return json({}, 401);
      return json({ success: true, user });
    };
    const order = app.dispatch(
      burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
    );
    const orderResult = order.unwrap().catch(() => undefined);
    const checking = app.dispatch(checkSession());
    await vi.waitFor(() =>
      expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(1)
    );
    order.abort();
    refreshing.resolve(json({ success: true, ...renewed }));
    await Promise.all([orderResult, checking]);
    expect(requests.filter((r) => r.url.endsWith('/orders'))).toHaveLength(1);
    expect(app.getState().auth.status).toBe('authenticated');
    expect(readTokens()).toEqual(renewed);
  });

  it('не восстанавливает старую сессию поздним refresh после выхода', async () => {
    saveTokens(tokens);
    const refreshing = deferred<Response>();
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token') ? refreshing.promise : json({}, 401);
    const checking = app.dispatch(checkSession());
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    clearTokens();
    app.dispatch(sessionEnded());
    refreshing.resolve(json({ success: true, ...renewed }));
    await checking;
    expect(readTokens()).toBeNull();
    expect(app.getState().auth.status).toBe('anonymous');
    expect(requests).toHaveLength(2);
  });

  it('позволяет новую попытку после тайм-аута общего refresh', async () => {
    vi.useFakeTimers();
    saveTokens(tokens);
    respond = (request): Response | Promise<Response> => {
      if (!request.url.endsWith('auth/token')) return json({}, 401);
      return new Promise((_resolve, reject) =>
        request.signal.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        })
      );
    };
    const checking = app.dispatch(checkSession());
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    await vi.advanceTimersByTimeAsync(60_001);
    await checking;
    expect(app.getState().auth.status).toBe('error');
    expect(readTokens()).toEqual(tokens);
    vi.useRealTimers();
    respond = (): Response | Promise<Response> => json({ success: true, user });
    await app.dispatch(checkSession());
    expect(app.getState().auth.status).toBe('authenticated');
  });
});
