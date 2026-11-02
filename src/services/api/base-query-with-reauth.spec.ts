// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { burgerApi } from '@services/api/burger-api';
import { sessionEnded, sessionEstablished } from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { checkSession } from '@services/auth/auth-thunks';
import { readTokens, saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

const user = { name: 'Тест', email: 'test@example.test' };

const tokens = { accessToken: 'Bearer old', refreshToken: 'old-refresh' };

const renewed = { accessToken: 'Bearer new', refreshToken: 'new-refresh' };

// Только тестовые endpoint: одинаковый URL позволяет проверить выбор политики по опциям.
const policyTestApi = burgerApi.injectEndpoints({
  endpoints: (builder) => ({
    policyEnabledProbe: builder.mutation<unknown, { value: string }>({
      query: (body) => ({ url: 'policy-probe', method: 'POST', body }),
      extraOptions: { auth: true },
    }),
    policyDisabledProbe: builder.mutation<unknown, { value: string }>({
      query: (body) => ({ url: 'policy-probe', method: 'POST', body }),
      extraOptions: { auth: false },
    }),
    policyDefaultProbe: builder.mutation<unknown, { value: string }>({
      query: (body) => ({ url: 'policy-probe', method: 'POST', body }),
    }),
    policyEmptyProbe: builder.mutation<unknown, { value: string }>({
      query: (body) => ({ url: 'policy-probe', method: 'POST', body }),
      extraOptions: {},
    }),
  }),
});

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

describe('Транспорт API: авторизация и обновление токенов', () => {
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

  it.each([401, 403])(
    'произвольное имя endpoint использует auth и refresh после %s',
    async (status) => {
      saveTokens(tokens);
      respond = (request): Response =>
        request.url.endsWith('auth/token')
          ? json({ success: true, ...renewed })
          : request.headers.get('authorization') === tokens.accessToken
            ? json({}, status)
            : json({ success: true });
      const body = { value: 'fixture' };
      await app
        .dispatch(policyTestApi.endpoints.policyEnabledProbe.initiate(body))
        .unwrap();
      expect(requests).toHaveLength(3);
      for (const index of [0, 2]) {
        expect(requests[index].url).toBe(
          'https://new-stellarburgers.education-services.ru/api/policy-probe'
        );
        expect(requests[index].method).toBe('POST');
        expect(await requests[index].json()).toEqual(body);
        expect(requests[index].headers.has('auth')).toBe(false);
      }
      expect(requests[0].headers.get('authorization')).toBe(tokens.accessToken);
      expect(requests[2].headers.get('authorization')).toBe(renewed.accessToken);
      expect(await requests[1].json()).toEqual({ token: tokens.refreshToken });
      expect(requests[1].headers.get('authorization')).toBeNull();
    }
  );

  describe.each([401, 403])('публичная политика после HTTP %s', (status) => {
    it.each(['policyDisabledProbe', 'policyDefaultProbe', 'policyEmptyProbe'] as const)(
      '%s не добавляет токен и не запускает refresh',
      async (endpoint) => {
        saveTokens(tokens);
        const auth = app.getState().auth;
        respond = (): Response => json({}, status);
        const body = { value: 'fixture' };
        await expect(
          app.dispatch(policyTestApi.endpoints[endpoint].initiate(body)).unwrap()
        ).rejects.toBeDefined();
        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe(
          'https://new-stellarburgers.education-services.ru/api/policy-probe'
        );
        expect(requests[0].headers.get('authorization')).toBeNull();
        expect(await requests[0].json()).toEqual(body);
        expect(readTokens()).toEqual(tokens);
        expect(app.getState().auth).toEqual(auth);
      }
    );
  });

  it.each([401, 403])(
    'PATCH обновляет токены после %s и повторяет то же тело один раз',
    async (status) => {
      saveTokens(tokens);
      const body = { ...user, password: 'x' };
      respond = (request): Response =>
        request.url.endsWith('auth/token')
          ? json({ success: true, ...renewed })
          : request.headers.get('authorization') === tokens.accessToken
            ? json({}, status)
            : json({ success: true, user });
      await app.dispatch(burgerApi.endpoints.updateCurrentUser.initiate(body)).unwrap();
      expect(requests.map((request) => request.method)).toEqual([
        'PATCH',
        'POST',
        'PATCH',
      ]);
      expect(await requests[0].json()).toEqual(body);
      expect(await requests[1].json()).toEqual({ token: tokens.refreshToken });
      expect(await requests[2].json()).toEqual(body);
      expect(requests[2].headers.get('authorization')).toBe(renewed.accessToken);
      expect(readTokens()).toEqual(renewed);
    }
  );

  it.each(['refresh', 'retry'])(
    'PATCH завершает сессию при отказе %s',
    async (stage) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      respond = (request): Response =>
        request.url.endsWith('auth/token') && stage === 'retry'
          ? json({ success: true, ...renewed })
          : json({}, 403);
      await expect(
        app
          .dispatch(
            burgerApi.endpoints.updateCurrentUser.initiate({ ...user, password: '' })
          )
          .unwrap()
      ).rejects.toBeDefined();
      expect(requests).toHaveLength(stage === 'refresh' ? 2 : 3);
      expect(app.getState().auth.status).toBe('anonymous');
      expect(readTokens()).toBeNull();
    }
  );

  it.each(['network', 'server'])(
    'PATCH не повторяет обычную ошибку %s',
    async (kind) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      respond = (): Response => {
        if (kind === 'network') throw new TypeError('Offline');
        return json({}, 500);
      };
      await expect(
        app
          .dispatch(
            burgerApi.endpoints.updateCurrentUser.initiate({ ...user, password: '' })
          )
          .unwrap()
      ).rejects.toBeDefined();
      expect(requests).toHaveLength(1);
      expect(readTokens()).toEqual(tokens);
      expect(app.getState().auth.status).toBe('authenticated');
    }
  );

  it('PATCH, GET пользователя и заказ разделяют один refresh', async () => {
    saveTokens(tokens);
    const refreshing = deferred<Response>();
    respond = (request): Response | Promise<Response> => {
      if (request.url.endsWith('auth/token')) return refreshing.promise;
      if (request.headers.get('authorization') === tokens.accessToken)
        return json({}, 401);
      return request.url.endsWith('/orders')
        ? json({ success: true, name: 'Бургер', order: { number: 12 } })
        : json({ success: true, user });
    };
    const patch = app.dispatch(
      burgerApi.endpoints.updateCurrentUser.initiate({ ...user, password: '' })
    );
    const get = app.dispatch(
      burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
    );
    const order = app.dispatch(
      burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
    );
    await vi.waitFor(() => expect(requests).toHaveLength(4));
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(1);
    refreshing.resolve(json({ success: true, ...renewed }));
    await Promise.all([patch.unwrap(), get.unwrap(), order.unwrap()]);
    expect(requests).toHaveLength(7);
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(1);
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
      app
        .dispatch(
          burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
        )
        .unwrap()
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
      app
        .dispatch(
          burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
        )
        .unwrap()
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

  it.each(['исходный запрос', 'повтор'] as const)(
    'отмена заказа сохраняет сессию и не запускает новый refresh: %s',
    async (stage) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      const started = deferred<void>();
      respond = (request): Response | Promise<Response> => {
        if (request.url.endsWith('auth/token'))
          return json({ success: true, ...renewed });
        if (
          stage === 'повтор' &&
          request.headers.get('authorization') === tokens.accessToken
        )
          return json({}, 401);
        return new Promise<Response>((_resolve, reject) => {
          const abort = (): void => reject(new DOMException('Aborted', 'AbortError'));
          if (request.signal.aborted) abort();
          else request.signal.addEventListener('abort', abort, { once: true });
          started.resolve();
        });
      };
      const order = app.dispatch(
        burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
      );
      const result = order.unwrap();
      await started.promise;
      order.abort();
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      // unwrap отклоняется раньше завершения собственного кода baseQuery.
      // Следующая задача event loop даёт ему обработать отказ отменённого fetch.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(requests).toHaveLength(stage === 'повтор' ? 3 : 1);
      expect(requests.at(-1)?.signal.aborted).toBe(true);
      expect(readTokens()).toEqual(stage === 'повтор' ? renewed : tokens);
      expect(app.getState().auth).toMatchObject({ status: 'authenticated', user });
    }
  );

  it('ошибка чтения токенов завершает операцию ошибкой сессии без HTTP', async () => {
    app.dispatch(sessionEstablished(user));
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    await expect(
      app
        .dispatch(burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] }))
        .unwrap()
    ).rejects.toMatchObject({ status: 'CUSTOM_ERROR' });
    expect(requests).toHaveLength(0);
    expect(app.getState().auth).toMatchObject({ status: 'error', user: null });
  });

  it.each([200, 401, 500])(
    'поздний исходный PATCH не меняет новую сессию (%s)',
    async (status) => {
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      const pending = deferred<Response>();
      respond = (): Response | Promise<Response> => pending.promise;
      const old = app.dispatch(
        burgerApi.endpoints.updateCurrentUser.initiate({
          ...user,
          password: 'old-password',
        })
      );
      const outcome = old.unwrap().catch((error: unknown) => error);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      app.dispatch(sessionEnded());
      const other = { name: 'Другой', email: 'other@example.test' };
      const otherTokens = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
      saveTokens(otherTokens);
      app.dispatch(sessionEstablished(other));
      pending.resolve(json({ success: true, user }, status));
      expect(await outcome).toMatchObject({ status: 'CUSTOM_ERROR' });
      expect(requests).toHaveLength(1);
      expect(readTokens()).toEqual(otherTokens);
      expect(app.getState().auth).toMatchObject({
        status: 'authenticated',
        user: other,
      });
    }
  );

  it.each([200, 401, 500])(
    'поздний retry не меняет новую сессию (%s)',
    async (status) => {
      saveTokens(tokens);
      const pending = deferred<Response>();
      respond = (request): Response | Promise<Response> =>
        request.url.endsWith('auth/token')
          ? json({ success: true, ...renewed })
          : request.headers.get('authorization') === tokens.accessToken
            ? json({}, 401)
            : pending.promise;
      const old = app.dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
      );
      const outcome = old.unwrap().catch((error: unknown) => error);
      await vi.waitFor(() => expect(requests).toHaveLength(3));
      app.dispatch(sessionEnded());
      const otherTokens = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
      saveTokens(otherTokens);
      app.dispatch(sessionEstablished({ ...user, name: 'Другой' }));
      pending.resolve(json({ success: true, user }, status));
      expect(await outcome).toMatchObject({ status: 'CUSTOM_ERROR' });
      expect(requests).toHaveLength(3);
      expect(readTokens()).toEqual(otherTokens);
      expect(app.getState().auth.user?.name).toBe('Другой');
    }
  );

  it('подтверждённый отказ инвалидирует поколение и при ошибке очистки storage', async () => {
    saveTokens(tokens);
    const version = app.getState().auth.version;
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    respond = (): Response | Promise<Response> => json({}, 401);
    await expect(
      app.dispatch(burgerApi.endpoints.getCurrentUser.initiate(version)).unwrap()
    ).rejects.toBeDefined();
    expect(app.getState().auth).toMatchObject({ status: 'error', version: version + 1 });
  });

  it.each([200, 403, 500])(
    'старый refresh не меняет новую пару и не удаляет её pending refresh (%s)',
    async (status) => {
      saveTokens(tokens);
      const oldRefresh = deferred<Response>();
      const newRefresh = deferred<Response>();
      const other = { name: 'Другой', email: 'other@example.test' };
      const otherTokens = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
      const otherRenewed = {
        accessToken: 'Bearer other-renewed',
        refreshToken: 'other-renewed-refresh',
      };
      respond = async (request): Promise<Response> => {
        if (request.url.endsWith('auth/token')) {
          const body = (await request.clone().json()) as { token: string };
          return body.token === tokens.refreshToken
            ? oldRefresh.promise
            : newRefresh.promise;
        }
        if (request.headers.get('authorization') !== otherRenewed.accessToken)
          return json({}, 401);
        return request.url.endsWith('/orders')
          ? json({ success: true, name: 'Бургер', order: { number: 10 } })
          : json({ success: true, user: other });
      };
      const old = app.dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
      );
      const oldResult = old.unwrap().catch((error: unknown) => error);
      await vi.waitFor(() =>
        expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(1)
      );
      app.dispatch(sessionEnded());
      saveTokens(otherTokens);
      app.dispatch(sessionEstablished(other));
      const current = app.dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
      );
      const currentResult = current.unwrap();
      await vi.waitFor(() =>
        expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(2)
      );
      oldRefresh.resolve(json({ success: true, ...renewed }, status));
      expect(await oldResult).toMatchObject({ status: 'CUSTOM_ERROR' });
      expect(readTokens()).toEqual(otherTokens);
      const order = app.dispatch(
        burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
      );
      const orderResult = order.unwrap();
      await vi.waitFor(() =>
        expect(requests.filter((r) => r.url.endsWith('/orders'))).toHaveLength(1)
      );
      // Дать исходному 401 заказа присоединиться к уже выполняющемуся refresh B.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(2);
      newRefresh.resolve(json({ success: true, ...otherRenewed }));
      expect((await currentResult).user).toEqual(other);
      await orderResult;
      expect(readTokens()).toEqual(otherRenewed);
      expect(app.getState().auth.user).toEqual(other);
      expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(2);
    }
  );

  it('поздний тайм-аут refresh не меняет новую сессию', async () => {
    vi.useFakeTimers();
    saveTokens(tokens);
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token')
        ? new Promise<Response>((_resolve, reject) =>
            request.signal.addEventListener(
              'abort',
              () => reject(new Error('Aborted')),
              { once: true }
            )
          )
        : json({}, 401);
    const old = app.dispatch(
      burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version)
    );
    const outcome = old.unwrap().catch((error: unknown) => error);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    app.dispatch(sessionEnded());
    const otherTokens = { accessToken: 'Bearer other', refreshToken: 'other-refresh' };
    saveTokens(otherTokens);
    app.dispatch(sessionEstablished({ ...user, name: 'Другой' }));
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await outcome).toMatchObject({ status: 'CUSTOM_ERROR' });
    expect(readTokens()).toEqual(otherTokens);
    expect(app.getState().auth).toMatchObject({
      status: 'authenticated',
      user: { ...user, name: 'Другой' },
    });
    expect(requests).toHaveLength(2);
  });

  it('начальная проверка не инвалидирует параллельный заказ той же сессии', async () => {
    saveTokens(tokens);
    const pending = deferred<Response>();
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('/orders') ? pending.promise : json({ success: true, user });
    const version = app.getState().auth.version;
    const checking = app.dispatch(checkSession());
    const order = app.dispatch(
      burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
    );
    const result = order.unwrap();
    await checking;
    expect(app.getState().auth.version).toBe(version);
    pending.resolve(json({ success: true, name: 'Бургер', order: { number: 11 } }));
    expect((await result).order.number).toBe(11);
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
    const refreshRequest = requests.find((request) =>
      request.url.endsWith('auth/token')
    );
    order.abort();
    // Внешний RTK Promise завершается до ответа общего refresh.
    await orderResult;
    expect(refreshRequest?.signal.aborted).toBe(false);
    expect(requests.filter((r) => r.url.endsWith('/orders'))).toHaveLength(1);
    refreshing.resolve(json({ success: true, ...renewed }));
    await Promise.all([orderResult, checking]);
    expect(requests.filter((r) => r.url.endsWith('/orders'))).toHaveLength(1);
    expect(app.getState().auth.status).toBe('authenticated');
    expect(readTokens()).toEqual(renewed);
  });

  it.each([401, 500])(
    'ошибка общего refresh завершает всех потребителей (%s)',
    async (status) => {
      saveTokens(tokens);
      const refreshing = deferred<Response>();
      respond = (request): Response | Promise<Response> =>
        request.url.endsWith('auth/token') ? refreshing.promise : json({}, 401);
      const query = app.dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version, {
          subscribe: false,
        })
      );
      const order = app.dispatch(
        burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
      );
      const results = [
        query.unwrap().catch(() => undefined),
        order.unwrap().catch(() => undefined),
      ];
      await vi.waitFor(() =>
        expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(1)
      );
      refreshing.resolve(json({}, status));
      await Promise.all(results);
      expect(requests).toHaveLength(3);
      expect(readTokens()).toEqual(status === 401 ? null : tokens);
      if (status === 500) {
        respond = (): Response => json({ success: true, user });
        await app
          .dispatch(
            burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version, {
              forceRefetch: true,
              subscribe: false,
            })
          )
          .unwrap();
        expect(requests).toHaveLength(4);
      }
    }
  );

  it('разные store запускают независимые refresh', async () => {
    saveTokens(tokens);
    const other = createTestStore();
    const refreshing = deferred<void>();
    respond = (request): Response | Promise<Response> => {
      if (request.url.endsWith('auth/token'))
        return refreshing.promise.then(() => json({ success: true, ...renewed }));
      return request.headers.get('authorization') === tokens.accessToken
        ? json({}, 401)
        : json({ success: true, user });
    };
    try {
      const first = app.dispatch(checkSession());
      const second = other.dispatch(checkSession());
      await vi.waitFor(() =>
        expect(requests.filter((r) => r.url.endsWith('auth/token'))).toHaveLength(2)
      );
      refreshing.resolve(undefined);
      await Promise.all([first, second]);
      expect(app.getState().auth.user).toEqual(user);
      expect(other.getState().auth.user).toEqual(user);
    } finally {
      other.dispatch(burgerApi.util.resetApiState());
    }
  });

  it('позволяет новый refresh после полного тайм-аута предыдущего', async () => {
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
    respond = (request): Response =>
      request.url.endsWith('auth/token')
        ? json({ success: true, ...renewed })
        : request.headers.get('authorization') === tokens.accessToken
          ? json({}, 401)
          : json({ success: true, user });
    await app.dispatch(checkSession());
    expect(app.getState().auth.status).toBe('authenticated');
    expect(readTokens()).toEqual(renewed);
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(2);
  });

  it.each(['headers', 'body'])(
    'полный тайм-аут общего refresh завершает всех потребителей: %s',
    async (phase) => {
      vi.useFakeTimers();
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      let streamingResponse: Response | undefined;
      respond = (request): Response | Promise<Response> => {
        if (!request.url.endsWith('auth/token')) return json({}, 401);
        if (phase === 'body') {
          const body = new ReadableStream<Uint8Array>({
            start(controller): void {
              controller.enqueue(new TextEncoder().encode('{"success":'));
              request.signal.addEventListener(
                'abort',
                () => controller.error(new DOMException('Aborted', 'AbortError')),
                { once: true }
              );
            },
          });
          streamingResponse = new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
          return streamingResponse;
        }
        return new Promise((_resolve, reject) =>
          request.signal.addEventListener('abort', () => reject(new Error('Aborted')), {
            once: true,
          })
        );
      };
      const query = app.dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version, {
          subscribe: false,
        })
      );
      const order = app.dispatch(
        burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
      );
      const results = Promise.all([
        query.unwrap().catch((error: unknown) => error),
        order.unwrap().catch((error: unknown) => error),
      ]);
      await vi.waitFor(() => expect(requests).toHaveLength(3));
      expect(
        requests.filter((request) => request.url.endsWith('auth/token'))
      ).toHaveLength(1);
      if (phase === 'body')
        await vi.waitFor(() => expect(streamingResponse?.bodyUsed).toBe(true));
      await vi.advanceTimersByTimeAsync(60_001);
      const errors = await results;
      expect(errors).toEqual([
        expect.objectContaining({ status: 'TIMEOUT_ERROR' }),
        expect.objectContaining({ status: 'TIMEOUT_ERROR' }),
      ]);
      expect(
        requests.find((request) => request.url.endsWith('auth/token'))?.signal.aborted
      ).toBe(true);
      expect(requests).toHaveLength(3);
      expect(readTokens()).toEqual(tokens);
      expect(app.getState().auth.status).toBe('authenticated');
    }
  );

  it('новый потребитель не продлевает срок общего refresh', async () => {
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
    const query = app.dispatch(
      burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version, {
        subscribe: false,
      })
    );
    const queryResult = query.unwrap().catch((error: unknown) => error);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    await vi.advanceTimersByTimeAsync(30_000);
    const order = app.dispatch(
      burgerApi.endpoints.createOrder.initiate({ ingredients: ['bun'] })
    );
    const orderResult = order.unwrap().catch((error: unknown) => error);
    await vi.waitFor(() => expect(requests).toHaveLength(3));
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await Promise.all([queryResult, orderResult])).toEqual([
      expect.objectContaining({ status: 'TIMEOUT_ERROR' }),
      expect.objectContaining({ status: 'TIMEOUT_ERROR' }),
    ]);
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(1);
    expect(requests).toHaveLength(3);
    expect(readTokens()).toEqual(tokens);
  });

  it.each(['success', 'server', 'invalid', 'storage'])(
    'освобождает таймер завершённого refresh: %s',
    async (outcome) => {
      vi.useFakeTimers();
      saveTokens(tokens);
      app.dispatch(sessionEstablished(user));
      if (outcome === 'storage')
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
          throw new Error('Denied');
        });
      respond = (request): Response => {
        if (request.url.endsWith('auth/token')) {
          if (outcome === 'server') return json({}, 500);
          if (outcome === 'invalid') return json({ success: false });
          return json({ success: true, ...renewed });
        }
        return request.headers.get('authorization') === tokens.accessToken
          ? json({}, 401)
          : json({ success: true, user });
      };
      const query = app.dispatch(
        burgerApi.endpoints.getCurrentUser.initiate(app.getState().auth.version, {
          subscribe: false,
        })
      );
      await query.unwrap().catch(() => undefined);
      const refreshRequest = requests.find((request) =>
        request.url.endsWith('auth/token')
      );
      expect(refreshRequest).toBeDefined();
      expect(refreshRequest?.signal.aborted).toBe(false);
      const auth = app.getState().auth;
      const saved = readTokens();
      await vi.advanceTimersByTimeAsync(60_001);
      expect(refreshRequest?.signal.aborted).toBe(false);
      expect(app.getState().auth).toEqual(auth);
      expect(readTokens()).toEqual(saved);
    }
  );
});
