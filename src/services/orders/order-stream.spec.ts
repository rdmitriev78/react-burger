import { personalSnapshot, publicSnapshot } from '@/test/fixtures/orders/order-streams';
import { createdOrder, repeatedOrder } from '@/test/fixtures/orders/orders';
import { FakeWebSocket } from '@/test/helpers/fake-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { burgerApi } from '@services/api/burger-api';
import { sessionEnded, sessionEstablished } from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { clearTokens, readTokens, saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

import { retryOrderStream } from './order-stream';

const user = { name: 'Тест', email: 'test@example.test' };
const tokens = { accessToken: 'Bearer old', refreshToken: 'refresh' };
const renewed = { accessToken: 'Bearer new', refreshToken: 'renewed' };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('потоки заказов', () => {
  let store: ReturnType<typeof createTestStore>;
  let respond: (request: Request) => Response | Promise<Response>;
  let requests: Request[];

  beforeEach(() => {
    FakeWebSocket.instances = [];
    FakeWebSocket.onCreate = undefined;
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('localStorage', createTestStorage());
    const NativeRequest = Request;
    vi.stubGlobal(
      'Request',
      class extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(input, { ...init, signal: undefined });
        }
      }
    );
    requests = [];
    respond = (): Response => json({ success: true, ...renewed });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const request = input as Request;
        requests.push(request);
        return Promise.resolve(respond(request));
      })
    );
    store = createTestStore();
  });
  afterEach(async () => {
    store.dispatch(burgerApi.util.resetApiState());
    await Promise.resolve();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const feed = async (): Promise<FakeWebSocket> => {
    await store.dispatch(burgerApi.endpoints.getOrderFeed.initiate()).unwrap();
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    return FakeWebSocket.instances.at(-1)!;
  };
  const personal = async (): Promise<{
    socket: FakeWebSocket;
    version: number;
    unsubscribe: () => void;
  }> => {
    saveTokens(tokens);
    store.dispatch(sessionEstablished(user));
    const version = store.getState().auth.version;
    const subscription = store.dispatch(
      burgerApi.endpoints.getUserOrders.initiate(version)
    );
    await subscription.unwrap();
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    return {
      socket: FakeWebSocket.instances.at(-1)!,
      version,
      unsubscribe: () => subscription.unsubscribe(),
    };
  };
  const feedData = (): ReturnType<
    ReturnType<typeof burgerApi.endpoints.getOrderFeed.select>
  >['data'] => burgerApi.endpoints.getOrderFeed.select()(store.getState()).data;

  it('полностью заменяет снимки, сохраняет порядок и пустой ответ без HTTP', async () => {
    const socket = await feed();
    expect(socket.url).toMatch(/orders\/all$/);
    socket.receive(publicSnapshot);
    socket.receive({
      ...publicSnapshot,
      orders: [repeatedOrder, createdOrder],
      totalToday: 15,
    });
    expect(feedData()?.snapshot?.orders.map((order) => order.id)).toEqual([
      repeatedOrder._id,
      createdOrder._id,
    ]);
    expect(feedData()?.snapshot?.totalToday).toBe(15);
    socket.receive({ ...publicSnapshot, orders: [] });
    expect(feedData()?.snapshot?.orders).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('сохраняет снимок при неправильном JSON и восстанавливается после правильного сообщения', async () => {
    const socket = await feed();
    socket.receive(publicSnapshot);
    socket.receiveText('{');
    expect(feedData()?.status).toBe('error');
    expect(feedData()?.snapshot?.orders).toHaveLength(3);
    socket.receive({ success: true, orders: [] });
    expect(feedData()?.snapshot?.orders).toHaveLength(3);
    socket.receive(publicSnapshot);
    expect(feedData()?.status).toBe('connected');
  });

  it('имеет один таймер после error+close, увеличивает задержку и сбрасывает её после снимка', async () => {
    vi.useFakeTimers();
    const socket = await feed();
    socket.receive(publicSnapshot);
    for (const delay of [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]) {
      const connections = FakeWebSocket.instances.length;
      FakeWebSocket.instances.at(-1)!.fail();
      expect(feedData()?.snapshot?.orders).toHaveLength(3);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(FakeWebSocket.instances).toHaveLength(connections);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeWebSocket.instances).toHaveLength(connections + 1);
    }
    FakeWebSocket.instances.at(-1)!.receive(publicSnapshot);
    FakeWebSocket.instances.at(-1)!.fail();
    const connections = FakeWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances).toHaveLength(connections);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(connections + 1);
  });

  it('ручной повтор отменяет таймер, а удаление кеша закрывает поток и обработчики', async () => {
    vi.useFakeTimers();
    const subscription = store.dispatch(burgerApi.endpoints.getOrderFeed.initiate());
    await subscription.unwrap();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const first = FakeWebSocket.instances[0];
    first.fail();
    store.dispatch(retryOrderStream({ kind: 'feed' }));
    expect(FakeWebSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    subscription.unsubscribe();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWebSocket.instances[1].readyState).toBe(3);
    first.receive(publicSnapshot);
    store.dispatch(retryOrderStream({ kind: 'feed' }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('обновляет токен персонального потока и завершает сессию при втором отказе', async () => {
    const { socket } = await personal();
    expect(new URL(socket.url).searchParams.get('token')).toBe('old');
    socket.receive({ success: false, message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(socket.readyState).toBe(3);
    expect(new URL(FakeWebSocket.instances[1].url).searchParams.get('token')).toBe(
      'new'
    );
    expect(requests).toHaveLength(1);
    expect(readTokens()).toEqual(renewed);
    FakeWebSocket.instances[1].receive({ message: 'Invalid or missing token' });
    expect(store.getState().auth.status).toBe('anonymous');
    expect(readTokens()).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it('успешный снимок допускает новый цикл при последующем истечении', async () => {
    const { socket } = await personal();
    socket.receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    FakeWebSocket.instances[1].receive(personalSnapshot);
    FakeWebSocket.instances[1].receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(3));
    expect(requests).toHaveLength(2);
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('временная ошибка refresh сохраняет токены и ждёт ручного повтора', async () => {
    vi.useFakeTimers();
    const { socket, version } = await personal();
    respond = (): Response => json({}, 503);
    socket.receive(personalSnapshot);
    socket.receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() =>
      expect(
        burgerApi.endpoints.getUserOrders.select(version)(store.getState()).data?.status
      ).toBe('error')
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(readTokens()).toEqual(tokens);
    respond = (): Response => json({ success: true, ...renewed });
    store.dispatch(retryOrderStream({ kind: 'user', version }));
    FakeWebSocket.instances[1].receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(3));
  });

  it('использует один refresh для HTTP и WS и не восстанавливает завершённую сессию', async () => {
    const { socket, version } = await personal();
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token')
        ? pending
        : request.headers.get('authorization') === tokens.accessToken
          ? json({}, 401)
          : json({ success: true, user });
    const http = store.dispatch(burgerApi.endpoints.getCurrentUser.initiate(version));
    socket.receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    clearTokens();
    store.dispatch(sessionEnded());
    finish(json({ success: true, ...renewed }));
    await expect(http.unwrap()).rejects.toBeDefined();
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(readTokens()).toBeNull();
  });

  it('уход из истории не отменяет общий refresh и повтор HTTP, но не восстанавливает сокет', async () => {
    const { socket, version, unsubscribe } = await personal();
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token')
        ? pending
        : request.headers.get('authorization') === tokens.accessToken
          ? json({}, 401)
          : json({ success: true, user });
    const http = store.dispatch(burgerApi.endpoints.getCurrentUser.initiate(version));
    socket.receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    unsubscribe();
    await vi.waitFor(() =>
      expect(
        burgerApi.endpoints.getUserOrders.select(version)(store.getState()).data
      ).toBeUndefined()
    );
    finish(json({ success: true, ...renewed }));
    await expect(http.unwrap()).resolves.toMatchObject({ user });
    expect(readTokens()).toEqual(renewed);
    expect(store.getState().auth.status).toBe('authenticated');
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(socket.readyState).toBe(3);
    http.unsubscribe();
  });

  it('смена пользователя закрывает старый сокет и не смешивает снимки', async () => {
    const { socket, version } = await personal();
    socket.receive(personalSnapshot);
    store.dispatch(sessionEnded());
    saveTokens(renewed);
    store.dispatch(sessionEstablished({ ...user, name: 'Другой пользователь' }));
    const nextVersion = store.getState().auth.version;
    await store
      .dispatch(burgerApi.endpoints.getUserOrders.initiate(nextVersion))
      .unwrap();
    expect(socket.readyState).toBe(3);
    socket.receive(personalSnapshot);
    expect(
      burgerApi.endpoints.getUserOrders.select(nextVersion)(store.getState()).data
        ?.snapshot
    ).toBeNull();
    expect(
      burgerApi.endpoints.getUserOrders.select(version)(store.getState()).data?.snapshot
    ).toBeNull();
  });

  it('общий refresh успешно продолжает HTTP и персональный поток', async () => {
    const { socket, version } = await personal();
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/token')
        ? pending
        : request.headers.get('authorization') === tokens.accessToken
          ? json({}, 401)
          : json({ success: true, user });
    const http = store.dispatch(burgerApi.endpoints.getCurrentUser.initiate(version));
    socket.receive({ message: 'Invalid or missing token' });
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    finish(json({ success: true, ...renewed }));
    await expect(http.unwrap()).resolves.toMatchObject({ user });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(
      requests.filter((request) => request.url.endsWith('auth/token'))
    ).toHaveLength(1);
  });

  it('публичный поток не обновляет токен и не завершает сессию', async () => {
    saveTokens(tokens);
    store.dispatch(sessionEstablished(user));
    const socket = await feed();
    socket.receive({ message: 'Invalid or missing token' });
    expect(store.getState().auth.status).toBe('authenticated');
    expect(requests).toHaveLength(0);
  });

  it.each([
    [200, { success: true, order: createdOrder }, true],
    [200, { success: true, order: repeatedOrder }, false],
    [200, { success: true, order: {} }, false],
    [404, { success: false }, false],
    [503, { success: false }, false],
  ] as const)('проверяет GET заказа со статусом %i', async (status, body, valid) => {
    respond = (): Response => json(body, status);
    const request = store.dispatch(
      burgerApi.endpoints.getOrder.initiate({
        id: createdOrder._id,
        scope: { kind: 'feed' },
      })
    );
    if (valid)
      await expect(request.unwrap()).resolves.toMatchObject({ id: createdOrder._id });
    else await expect(request.unwrap()).rejects.toBeDefined();
    expect(requests[0].url).toMatch(new RegExp(createdOrder._id + '$'));
    expect(requests[0].headers.get('authorization')).toBeNull();
    request.unsubscribe();
  });

  it('два store независимо обрабатывают ручной повтор', async () => {
    await feed();
    const second = createTestStore();
    const subscription = second.dispatch(burgerApi.endpoints.getOrderFeed.initiate());
    await subscription.unwrap();
    expect(FakeWebSocket.instances).toHaveLength(2);
    store.dispatch(retryOrderStream({ kind: 'feed' }));
    expect(FakeWebSocket.instances[0].readyState).toBe(3);
    expect(FakeWebSocket.instances[1].readyState).toBe(0);
    second.dispatch(burgerApi.util.resetApiState());
  });
});
