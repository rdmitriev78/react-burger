import { testIngredients as ingredients } from '@/test/fixtures/ingredients/ingredients';
import { publicSnapshot } from '@/test/fixtures/orders/order-streams';
import { repeatedOrder } from '@/test/fixtures/orders/orders';
import { FakeWebSocket } from '@/test/helpers/fake-websocket';
import { installOrderTransport } from '@/test/helpers/order-transport';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@components/app/app';
import { IngredientModalRoute } from '@components/ingredient-modal-route/ingredient-modal-route';
import { OrderInfoModalRoute } from '@components/order-info-modal-route/order-info-modal-route';
import { FeedPage } from '@pages/feed/feed';
import { burgerApi } from '@services/api/burger-api';
import {
  checkingSession,
  sessionEstablished,
  sessionFailed,
} from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

describe('маршрутное окно ленты', () => {
  let store: ReturnType<typeof createTestStore>;
  let router: ReturnType<typeof createMemoryRouter>;
  let unsubscribe: (() => void) | undefined;
  let transport: ReturnType<typeof installOrderTransport>;

  const mount = (path = '/feed'): void => {
    router = createMemoryRouter(
      [
        {
          element: <App />,
          children: [
            {
              path: 'feed',
              element: <FeedPage />,
              children: [
                {
                  path: ':id',
                  element: <OrderInfoModalRoute />,
                },
              ],
            },
            {
              path: '/',
              element: <Outlet />,
              children: [{ path: 'ingredients/:id', element: <IngredientModalRoute /> }],
            },
          ],
        },
      ],
      { initialEntries: [path] }
    );
    // MemoryRouter не меняет адрес документа, используемый Modal для возврата фокуса.
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
      {
        container: document.getElementById('root') ?? undefined,
      }
    );
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div><div id="modal-root"></div>';
    vi.stubGlobal('localStorage', createTestStorage());
    // Request из Node и AbortSignal из jsdom принадлежат разным окружениям.
    const NativeRequest = Request;
    vi.stubGlobal(
      'Request',
      class extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(input, { ...init, signal: undefined });
        }
      }
    );
    // jsdom не рассчитывает layout; для проверки focus trap элементы считаются видимыми.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      new DOMRect(0, 0, 10, 10),
    ] as unknown as DOMRectList);
    transport = installOrderTransport();
    saveTokens({ accessToken: 'Bearer test', refreshToken: 'refresh' });
    store = createTestStore();
  });

  afterEach(() => {
    cleanup();
    unsubscribe?.();
    router.dispose();
    store.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('открывает карточку с клавиатуры, удерживает фокус и возвращает его после Escape', async () => {
    mount();
    const card = await screen.findByRole('link', { name: /Заказ #034530/ });
    card.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Информация о заказе' });
    expect(router.state.location.pathname).toBe('/feed/100000000000000000000003');
    expect(await within(dialog).findByText('250')).toBeInTheDocument();
    expect(document.getElementById('root')?.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    const close = within(dialog).getByRole('button', { name: 'Закрыть окно' });
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(within(dialog).getByRole('list', { name: 'Состав заказа' })).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(within(dialog).getByRole('list', { name: 'Состав заказа' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/feed');
    expect(card).toHaveFocus();
    expect(document.getElementById('root')?.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('по прямому URL открывает окно без state и заменяет его лентой при закрытии', async () => {
    mount('/feed/100000000000000000000002');
    const dialog = await screen.findByRole('dialog', { name: 'Информация о заказе' });
    expect(
      await within(dialog).findByRole('heading', {
        name: 'Interstellar бургер с длинным названием для межзвёздного путешествия',
      })
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByRole('link', { name: 'Лента заказов' })).toHaveFocus();
  });

  it('согласовывает окно с Back/Forward и сменой id, очищает его при уходе', async () => {
    mount();
    await userEvent.click(await screen.findByRole('link', { name: /Заказ #034530/ }));
    await screen.findByRole('dialog');
    await act(() => router.navigate(-1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(() => router.navigate(1));
    expect(within(screen.getByRole('dialog')).getByText('#034530')).toBeInTheDocument();
    await act(() => router.navigate('/feed/100000000000000000000002'));
    expect(within(screen.getByRole('dialog')).getByText('#034534')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Готовится')
    ).toBeInTheDocument();
    await act(() => router.navigate('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().modal.type).toBe('closed');
  });

  it('показывает неизвестный id и закрывает ошибку в ленту', async () => {
    mount('/feed/unknown-order');
    const dialog = await screen.findByRole('dialog', { name: 'Заказ не найден' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('сохраняет публичные детали при проверке, ошибке и подтверждении сессии', async () => {
    mount('/feed/100000000000000000000003');
    await screen.findByRole('dialog');
    for (const action of [
      checkingSession(),
      sessionFailed('Тестовая ошибка'),
      sessionEstablished({ name: 'Тест', email: 'test@example.test' }),
    ]) {
      act(() => {
        store.dispatch(action);
      });
      expect(
        screen.getByRole('dialog', { name: 'Информация о заказе' })
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/feed/100000000000000000000003');
    }
  });

  it('сохраняет закрытие прямой ссылки на ингредиент на главную', async () => {
    await store.dispatch(
      burgerApi.util.upsertQueryData('getIngredients', undefined, ingredients)
    );
    mount(`/ingredients/${ingredients[0]._id}`);
    const dialog = await screen.findByRole('dialog', { name: 'Детали ингредиента' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.getByRole('link', { name: 'Конструктор' })).toHaveFocus();
  });

  const getCalls = (): number =>
    transport.mock.calls.filter(([input]) => (input as Request).url.includes('/orders/'))
      .length;

  it('ждёт первый снимок и не делает GET для присутствующего заказа', async () => {
    FakeWebSocket.onCreate = undefined;
    mount(`/feed/${repeatedOrder._id}`);
    await screen.findByText('Загружаем заказ…');
    expect(getCalls()).toBe(0);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    act(() => FakeWebSocket.instances.at(-1)!.receive(publicSnapshot));
    await within(screen.getByRole('dialog')).findByText('250');
    expect(getCalls()).toBe(0);
  });

  it('отображает пустой снимок и сохраняет последний список при разрыве', async () => {
    mount();
    await screen.findByRole('link', { name: /Заказ #034530/ });
    const socket = FakeWebSocket.instances.at(-1)!;
    act(() => socket.fail());
    expect(await screen.findByRole('status')).toHaveTextContent('Связь потеряна');
    expect(screen.getByRole('link', { name: /Заказ #034530/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить подключение' }));
    await screen.findByRole('link', { name: /Заказ #034530/ });
    act(() =>
      FakeWebSocket.instances.at(-1)!.receive({ ...publicSnapshot, orders: [] })
    );
    expect(await screen.findByText('Заказов пока нет')).toBeInTheDocument();
  });

  it('обновляет открытый заказ без сброса фокуса и повторного GET', async () => {
    mount(`/feed/${repeatedOrder._id}`);
    const dialog = await screen.findByRole('dialog');
    const list = await within(dialog).findByRole('list', { name: 'Состав заказа' });
    list.focus();
    act(() =>
      FakeWebSocket.instances.at(-1)!.receive({
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, status: 'pending' }],
      })
    );
    expect(await within(dialog).findByText('Готовится')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(list).toHaveFocus();
    expect(getCalls()).toBe(0);
  });

  it.each([{ status: 'wrong' }, { ingredients: ['unknown'] }])(
    'не запрашивает заново непригодный заказ %o',
    async (patch) => {
      transport = installOrderTransport({
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, ...patch }],
      });
      mount(`/feed/${repeatedOrder._id}`);
      await screen.findByRole('dialog', { name: 'Некорректные данные заказа' });
      expect(getCalls()).toBe(0);
    }
  );

  it('запрашивает отсутствующий заказ один раз, не повторяя GET на каждом снимке', async () => {
    transport = installOrderTransport({ ...publicSnapshot, orders: [] });
    const original = transport.getMockImplementation()!;
    transport.mockImplementation((input, init) =>
      (input as Request).url.includes('/orders/')
        ? Promise.resolve(
            new Response(JSON.stringify({ success: true, order: repeatedOrder }), {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        : original(input, init)
    );
    mount(`/feed/${repeatedOrder._id}`);
    await within(await screen.findByRole('dialog')).findByText('250');
    act(() =>
      FakeWebSocket.instances.at(-1)!.receive({ ...publicSnapshot, orders: [] })
    );
    expect(getCalls()).toBe(1);
  });

  it('показывает 404 отдельно от временной ошибки GET и позволяет повтор', async () => {
    transport = installOrderTransport({ ...publicSnapshot, orders: [] });
    const original = transport.getMockImplementation()!;
    let status = 503;
    transport.mockImplementation((input, init) =>
      (input as Request).url.includes('/orders/')
        ? Promise.resolve(
            new Response('{}', {
              status,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        : original(input, init)
    );
    mount(`/feed/${repeatedOrder._id}`);
    const dialog = await screen.findByRole('dialog', {
      name: 'Не удалось загрузить заказ',
    });
    status = 404;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Повторить' }));
    await screen.findByRole('dialog', { name: 'Заказ не найден' });
    expect(getCalls()).toBe(2);
  });

  it('поток имеет приоритет над поздним GET, уход не открывает старое окно', async () => {
    transport = installOrderTransport({ ...publicSnapshot, orders: [] });
    const original = transport.getMockImplementation()!;
    let finish!: (response: Response) => void;
    transport.mockImplementation((input, init) =>
      (input as Request).url.includes('/orders/')
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : original(input, init)
    );
    mount(`/feed/${repeatedOrder._id}`);
    await waitFor(() => expect(getCalls()).toBe(1));
    act(() =>
      FakeWebSocket.instances.at(-1)!.receive({
        ...publicSnapshot,
        orders: [{ ...repeatedOrder, status: 'pending' }],
      })
    );
    await within(screen.getByRole('dialog')).findByText('Готовится');
    await act(async () => {
      finish(
        new Response(JSON.stringify({ success: true, order: repeatedOrder }), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await Promise.resolve();
    });
    expect(
      within(screen.getByRole('dialog')).getByText('Готовится')
    ).toBeInTheDocument();
    await act(() => router.navigate('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('загружает детали через GET после выхода заказа из последних пятидесяти', async () => {
    mount(`/feed/${repeatedOrder._id}`);
    await within(await screen.findByRole('dialog')).findByText('250');
    expect(getCalls()).toBe(0);
    act(() =>
      FakeWebSocket.instances.at(-1)!.receive({ ...publicSnapshot, orders: [] })
    );
    await screen.findByRole('dialog', { name: 'Заказ не найден' });
    expect(getCalls()).toBe(1);
  });

  it('показывает ошибку каталога и позволяет повторить его загрузку', async () => {
    const original = transport.getMockImplementation()!;
    transport.mockImplementation((input, init) =>
      (input as Request).url.endsWith('/ingredients')
        ? Promise.resolve(new Response('{}', { status: 503 }))
        : original(input, init)
    );
    mount();
    await screen.findByText('Не удалось загрузить ингредиенты.');
    transport.mockImplementation(original);
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByRole('link', { name: /Заказ #034530/ });
  });
});
