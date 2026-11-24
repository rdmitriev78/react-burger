import { publicSnapshot } from '@/test/fixtures/orders/order-streams';
import { repeatedOrder } from '@/test/fixtures/orders/orders';
import { FakeWebSocket } from '@/test/helpers/fake-websocket';
import { installOrderTransport } from '@/test/helpers/order-transport';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@components/app/app';
import { OrderInfoModalRoute } from '@components/order-info-modal-route/order-info-modal-route';
import { ProfileLayout } from '@components/profile-layout/profile-layout';
import { ProtectedRoute } from '@components/protected-route/protected-route';
import { FeedPage } from '@pages/feed/feed';
import { ProfileOrderPage } from '@pages/profile-order/profile-order';
import { burgerApi } from '@services/api/burger-api';
import { sessionEstablished } from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe.each(['/feed', '/profile/orders'])('детали заказа на %s', (basePath) => {
  let store: ReturnType<typeof createTestStore>;
  let router: ReturnType<typeof createMemoryRouter>;
  let unsubscribe: () => void;
  let transport: ReturnType<typeof installOrderTransport>;
  let snapshot: unknown;
  let respond: (request: Request) => Response | Promise<Response>;

  const mount = (id: string = repeatedOrder._id): void => {
    transport = installOrderTransport(snapshot);
    const original = transport.getMockImplementation()!;
    transport.mockImplementation((input, init) =>
      (input as Request).url.includes('/orders/')
        ? Promise.resolve(respond(input as Request))
        : original(input, init)
    );
    const path = `${basePath}/${id}`;
    router = createMemoryRouter(
      [
        {
          element: <App />,
          children: [
            {
              path: 'feed',
              element: <FeedPage />,
              children: [{ path: ':id', element: <OrderInfoModalRoute /> }],
            },
            {
              element: <ProtectedRoute />,
              children: [
                {
                  path: 'profile',
                  element: <ProfileLayout />,
                  children: [
                    {
                      path: 'orders',
                      element: <ProfileOrderPage />,
                      children: [{ path: ':id', element: <OrderInfoModalRoute /> }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      { initialEntries: [path] }
    );
    // Для возврата фокуса Modal читает фактический адрес документа.
    window.history.replaceState(null, '', path);
    unsubscribe = router.subscribe(({ location }) => {
      window.history.replaceState(null, '', location.pathname);
    });
    render(
      <StrictMode>
        <Provider store={store}>
          <RouterProvider router={router} />
        </Provider>
      </StrictMode>,
      { container: document.getElementById('root') ?? undefined }
    );
  };

  const orderRequests = (): Request[] =>
    transport.mock.calls
      .map(([input]) => input as Request)
      .filter((request) => request.url.includes('/orders/'));

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div><div id="modal-root"></div>';
    vi.stubGlobal('localStorage', createTestStorage());
    const NativeRequest = Request;
    // Node Request не принимает AbortSignal из jsdom; HTTP здесь подменён.
    vi.stubGlobal(
      'Request',
      class extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(input, { ...init, signal: undefined });
        }
      }
    );
    // Геометрию фокусируемых элементов дополнительно проверяем в браузере.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      new DOMRect(0, 0, 10, 10),
    ] as unknown as DOMRectList);
    saveTokens({ accessToken: 'Bearer test', refreshToken: 'refresh' });
    store = createTestStore();
    store.dispatch(sessionEstablished({ name: 'Тест', email: 'test@example.test' }));
    snapshot = { ...publicSnapshot, orders: [] };
    respond = (): Response => json({}, 503);
  });

  afterEach(() => {
    cleanup();
    unsubscribe();
    router.dispose();
    store.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([200, 503, 404])(
    'удерживает фокус при клавиатурном повторе, следующий ответ %s',
    async (status) => {
      mount();
      const dialog = await screen.findByRole('dialog', {
        name: 'Не удалось загрузить заказ',
      });
      let finish!: (response: Response) => void;
      respond = (): Promise<Response> =>
        new Promise((resolve) => {
          finish = resolve;
        });
      within(dialog).getByRole('button', { name: 'Повторить' }).focus();
      await userEvent.keyboard('{Enter}');
      await within(dialog).findByText('Загружаем заказ…');
      await waitFor(() => expect(orderRequests()).toHaveLength(2));
      const close = within(dialog).getByRole('button', { name: 'Закрыть окно' });
      expect(close).toHaveFocus();
      act(() => {
        finish(json({ success: true, order: repeatedOrder }, status));
      });
      await within(dialog).findByText(
        status === 200
          ? '250'
          : status === 404
            ? 'Проверьте ссылку или выберите другой заказ.'
            : 'Повторите попытку загрузки.'
      );
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(close).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      await userEvent.tab();
      expect(close).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe(basePath);
      expect(
        screen.getByRole('link', {
          name: basePath === '/feed' ? 'Лента заказов' : 'История заказов',
        })
      ).toHaveFocus();
    }
  );

  it('сохраняет фокус при обновлении состава и восстанавливает после его удаления', async () => {
    snapshot = publicSnapshot;
    mount();
    const dialog = await screen.findByRole('dialog');
    const list = await within(dialog).findByRole('list', { name: 'Состав заказа' });
    list.focus();
    const socket = FakeWebSocket.instances.at(-1)!;
    act(() =>
      socket.receive({
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, status: 'pending' }],
      })
    );
    await within(dialog).findByText('Готовится');
    expect(list).toHaveFocus();
    act(() =>
      socket.receive({
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, ingredients: ['unknown'] }],
      })
    );
    await within(dialog).findByText('Состав заказа недоступен в каталоге.');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByRole('button', { name: 'Закрыть окно' })).toHaveFocus();
    expect(orderRequests()).toHaveLength(0);
  });

  const id = 'abcdef0123456789abcdef01';
  const mixedId = 'AbCdEf0123456789aBcDeF01';

  it.each([id.toUpperCase(), mixedId])(
    'открывает заказ из снимка по ссылке %s без GET',
    async (routeId) => {
      snapshot = {
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, _id: id.toUpperCase() }],
      };
      mount(routeId);
      await within(await screen.findByRole('dialog')).findByText('250');
      expect(orderRequests()).toHaveLength(0);
      expect(router.state.location.pathname).toBe(`${basePath}/${routeId}`);
    }
  );

  it('использует канонический ID для GET, повтора и кеша при смене регистра адреса', async () => {
    mount(id.toUpperCase());
    const dialog = await screen.findByRole('dialog', {
      name: 'Не удалось загрузить заказ',
    });
    respond = (): Response =>
      json({ success: true, order: { ...repeatedOrder, _id: mixedId } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Повторить' }));
    await within(dialog).findByText('250');
    expect(orderRequests().map((request) => new URL(request.url).pathname)).toEqual([
      `/api/orders/${id}`,
      `/api/orders/${id}`,
    ]);
    expect(store.getState().modal).toMatchObject({ type: 'order-info', id });
    for (const routeId of [id, mixedId]) {
      await act(() => router.navigate(`${basePath}/${routeId}`));
      expect(router.state.location.pathname).toBe(`${basePath}/${routeId}`);
      expect(within(screen.getByRole('dialog')).getByText('250')).toBeInTheDocument();
      expect(orderRequests()).toHaveLength(2);
    }
  });

  it.each([{ status: 'wrong' }, { ingredients: ['unknown'] }])(
    'не делает GET отклонённого заказа при другом регистре ID: %o',
    async (patch) => {
      snapshot = {
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, _id: mixedId, ...patch }],
      };
      mount(id.toUpperCase());
      await screen.findByRole('dialog', { name: 'Некорректные данные заказа' });
      expect(orderRequests()).toHaveLength(0);
    }
  );

  it.each(['G'.repeat(24), 'a'.repeat(23), 'a'.repeat(25)])(
    'не запрашивает ID неправильного формата %s',
    async (routeId) => {
      mount(routeId);
      await screen.findByRole('dialog', { name: 'Заказ не найден' });
      expect(orderRequests()).toHaveLength(0);
    }
  );
});
