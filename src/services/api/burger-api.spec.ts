// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { burgerApi } from '@services/api/burger-api';
import { sessionEnded, sessionEstablished } from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { readTokens, saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

const user = { name: 'Тест', email: 'test@example.test' };

const tokens = { accessToken: 'Bearer old', refreshToken: 'old-refresh' };

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

describe('HTTP-контракты burgerApi', () => {
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

  describe.each([401, 403])(
    'публичные методы при сохранённых токенах и HTTP %s',
    (status) => {
      it.each(['login', 'register', 'logout', 'getIngredients'] as const)(
        '%s не передаёт access-токен и не обновляет сессию',
        async (endpoint) => {
          saveTokens(tokens);
          app.dispatch(sessionEstablished(user));
          const auth = app.getState().auth;
          respond = (): Response => json({}, status);
          const request =
            endpoint === 'login'
              ? app.dispatch(
                  burgerApi.endpoints.login.initiate({
                    email: user.email,
                    password: 'fixture',
                  })
                )
              : endpoint === 'register'
                ? app.dispatch(
                    burgerApi.endpoints.register.initiate({
                      ...user,
                      password: 'fixture',
                    })
                  )
                : endpoint === 'logout'
                  ? app.dispatch(
                      burgerApi.endpoints.logout.initiate({ token: tokens.refreshToken })
                    )
                  : app.dispatch(burgerApi.endpoints.getIngredients.initiate());
          await expect(request.unwrap()).rejects.toBeDefined();
          expect(requests).toHaveLength(1);
          expect(requests[0].headers.get('authorization')).toBeNull();
          expect(readTokens()).toEqual(tokens);
          expect(app.getState().auth).toEqual(auth);
        }
      );
    }
  );

  it.each(['', 'x'])('PATCH передаёт все поля и токен, пароль=%j', async (password) => {
    saveTokens(tokens);
    const body = { ...user, password };
    expect(
      await app.dispatch(burgerApi.endpoints.updateCurrentUser.initiate(body)).unwrap()
    ).toEqual({ success: true, user });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url).pathname).toBe('/api/auth/user');
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].headers.get('authorization')).toBe(tokens.accessToken);
    expect(await requests[0].json()).toEqual(body);
  });

  it.each([
    { success: false, user },
    { success: true },
    { success: true, user: { name: 'Имя', email: null } },
  ])('PATCH отклоняет некорректный ответ %j без повтора', async (body) => {
    saveTokens(tokens);
    respond = (): Response => json(body);
    await expect(
      app
        .dispatch(
          burgerApi.endpoints.updateCurrentUser.initiate({ ...user, password: '' })
        )
        .unwrap()
    ).rejects.toBeDefined();
    expect(requests).toHaveLength(1);
    expect(readTokens()).toEqual(tokens);
  });

  it('вход и регистрация используют правильные методы, тела и не запускают refresh', async () => {
    saveTokens(tokens);
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

  it('не отменяет публичный каталог при авторизации', async () => {
    saveTokens(tokens);
    const loading = deferred<Response>();
    respond = (): Promise<Response> => loading.promise;
    const query = app.dispatch(burgerApi.endpoints.getIngredients.initiate());
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].headers.get('authorization')).toBeNull();
    app.dispatch(sessionEnded());
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

  it.each([
    { status: 500, body: {} },
    { status: 200, body: { success: false, message: 'Rejected' } },
    { status: 200, body: { success: true } },
  ])('logout не очищает токены при ошибке ответа %j', async ({ status, body }) => {
    saveTokens(tokens);
    respond = (): Response => json(body, status);
    await expect(
      app
        .dispatch(burgerApi.endpoints.logout.initiate({ token: tokens.refreshToken }))
        .unwrap()
    ).rejects.toBeDefined();
    expect(requests).toHaveLength(1);
    expect(readTokens()).toEqual(tokens);
  });

  it('logout сохраняет токены и передаёт сетевую ошибку без повтора', async () => {
    saveTokens(tokens);
    respond = (): Response => {
      throw new TypeError('Offline');
    };
    await expect(
      app
        .dispatch(burgerApi.endpoints.logout.initiate({ token: tokens.refreshToken }))
        .unwrap()
    ).rejects.toMatchObject({ status: 'FETCH_ERROR' });
    expect(requests).toHaveLength(1);
    expect(readTokens()).toEqual(tokens);
  });

  it('logout отправляет переданный refresh-токен и возвращает HTTP-ответ без auth-эффектов', async () => {
    saveTokens(tokens);
    app.dispatch(sessionEstablished(user));
    const before = app.getState().auth;
    const body = { success: true, message: 'Successful logout' };
    respond = (): Response => json(body);
    expect(
      await app
        .dispatch(burgerApi.endpoints.logout.initiate({ token: tokens.refreshToken }))
        .unwrap()
    ).toEqual(body);
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url).pathname).toBe('/api/auth/logout');
    expect(requests[0].method).toBe('POST');
    expect(await requests[0].json()).toEqual({ token: tokens.refreshToken });
    expect(requests[0].headers.get('authorization')).toBeNull();
    expect(readTokens()).toEqual(tokens);
    expect(app.getState().auth).toEqual(before);
  });
});
