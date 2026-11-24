import { personalSnapshot } from '@/test/fixtures/orders/order-streams';
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
import { LoginPage } from '@pages/login/login';
import { ProfileOrderPage } from '@pages/profile-order/profile-order';
import { ProfilePage } from '@pages/profile/profile';
import { burgerApi } from '@services/api/burger-api';
import {
  checkingSession,
  sessionEnded,
  sessionEstablished,
  sessionFailed,
} from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

const user = { name: 'Тест', email: 'test@example.test' };

describe('история заказов и защищённые детали', () => {
  let store: ReturnType<typeof createTestStore>;
  let router: ReturnType<typeof createMemoryRouter>;
  let unsubscribe: () => void;

  const mount = (path = '/profile/orders'): void => {
    router = createMemoryRouter(
      [
        {
          element: <App />,
          children: [
            { path: '/', element: <h1>Главная</h1> },
            {
              element: <ProtectedRoute />,
              children: [
                {
                  path: 'profile',
                  element: <ProfileLayout />,
                  children: [
                    { index: true, element: <ProfilePage /> },
                    {
                      path: 'orders',
                      element: <ProfileOrderPage />,
                      children: [
                        {
                          path: ':id',
                          element: <OrderInfoModalRoute />,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              element: <ProtectedRoute onlyGuest />,
              children: [{ path: 'login', element: <LoginPage /> }],
            },
          ],
        },
      ],
      { initialEntries: [path] }
    );
    // Modal выбирает запасной фокус по фактическому адресу документа.
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

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div><div id="modal-root"></div>';
    vi.stubGlobal('localStorage', createTestStorage());
    // Node Request не принимает AbortSignal из jsdom; транспорт здесь подменён.
    const NativeRequest = Request;
    vi.stubGlobal(
      'Request',
      class extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(input, { ...init, signal: undefined });
        }
      }
    );
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              user,
              accessToken: 'Bearer test',
              refreshToken: 'refresh',
            }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        )
      )
    );
    // jsdom не рассчитывает геометрию, необходимую общему focus trap.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      new DOMRect(0, 0, 10, 10),
    ] as unknown as DOMRectList);
    installOrderTransport(personalSnapshot);
    saveTokens({ accessToken: 'Bearer test', refreshToken: 'refresh' });
    store = createTestStore();
    store.dispatch(sessionEstablished(user));
  });

  afterEach(() => {
    cleanup();
    unsubscribe();
    router.dispose();
    store.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('открывает профиль из шапки и историю из меню, сохраняет форму профиля', async () => {
    mount('/');
    await userEvent.click(screen.getByRole('link', { name: 'Личный кабинет' }));
    expect(router.state.location.pathname).toBe('/profile');
    expect(screen.getByLabelText('Имя')).toHaveValue(user.name);
    await userEvent.click(screen.getByRole('link', { name: 'История заказов' }));
    expect(router.state.location.pathname).toBe('/profile/orders');
    expect(screen.getByRole('link', { name: 'История заказов' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Личный кабинет' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      within(
        await screen.findByRole('list', { name: 'Заказы пользователя' })
      ).getAllByRole('listitem')
    ).toHaveLength(personalSnapshot.orders.length);
    expect(
      screen.getByText('В этом разделе вы можете просмотреть свою историю заказов')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Профиль' }));
    expect(screen.getByLabelText('Имя')).toHaveValue(user.name);
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
  });

  it('открывает карточку с Enter, удерживает фокус и возвращает его после Escape', async () => {
    mount();
    const card = await screen.findByRole('link', { name: /Заказ #034530/ });
    card.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Информация о заказе' });
    expect(router.state.location.pathname).toBe(
      '/profile/orders/100000000000000000000003'
    );
    expect(await within(dialog).findByText('250')).toBeInTheDocument();
    expect(document.getElementById('root')?.inert).toBe(true);
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
    expect(router.state.location.pathname).toBe('/profile/orders');
    expect(card).toHaveFocus();
    expect(document.getElementById('root')?.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it.each(['100000000000000000000002', 'unknown-order'])(
    'закрывает прямой адрес %s заменой на историю',
    async (id) => {
      mount(`/profile/orders/${id}`);
      const dialog = await screen.findByRole('dialog', {
        name: id === 'unknown-order' ? 'Заказ не найден' : 'Информация о заказе',
      });
      expect(
        await within(dialog).findByText(
          id === 'unknown-order'
            ? 'Проверьте ссылку или выберите другой заказ.'
            : 'Готовится'
        )
      ).toBeInTheDocument();
      await userEvent.click(
        within(dialog).getByRole('button', {
          name: id === 'unknown-order' ? 'Закрыть' : 'Закрыть окно',
        })
      );
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/profile/orders')
      );
      expect(router.state.historyAction).toBe('REPLACE');
      expect(screen.getByRole('link', { name: 'История заказов' })).toHaveFocus();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );

  it('согласовывает Back/Forward и смену заказа, очищает окно при уходе', async () => {
    mount();
    await userEvent.click(await screen.findByRole('link', { name: /Заказ #034530/ }));
    await screen.findByRole('dialog');
    await act(() => router.navigate(-1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(() => router.navigate(1));
    expect(within(screen.getByRole('dialog')).getByText('#034530')).toBeInTheDocument();
    await act(() => router.navigate('/profile/orders/100000000000000000000002'));
    expect(within(screen.getByRole('dialog')).getByText('#034534')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Готовится')
    ).toBeInTheDocument();
    await act(() => router.navigate('/'));
    expect(store.getState().modal.type).toBe('closed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.getElementById('root')?.inert).toBe(false);
  });

  it('ожидает сессию, показывает ошибку и открывает заказ только после подтверждения', async () => {
    store.dispatch(checkingSession());
    mount('/profile/orders/100000000000000000000003');
    expect(screen.getByText('Проверяем сессию…')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Заказы пользователя' })
    ).not.toBeInTheDocument();
    act(() => {
      store.dispatch(sessionFailed('Тестовая ошибка'));
    });
    expect(
      screen.getByRole('button', { name: 'Повторить проверку' })
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(
      '/profile/orders/100000000000000000000003'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      store.dispatch(sessionEstablished(user));
    });
    await screen.findByRole('dialog', { name: 'Информация о заказе' });
  });

  it('возвращает гостя после входа к деталям с query и hash', async () => {
    store.dispatch(sessionEnded());
    mount('/profile/orders/100000000000000000000003?view=recent#details');
    await screen.findByRole('heading', { name: 'Вход' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Заказы пользователя' })
    ).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('E-mail'), user.email);
    await userEvent.type(screen.getByLabelText('Пароль'), 'test-password');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByRole('dialog', { name: 'Информация о заказе' });
    const { pathname, search, hash } = router.state.location;
    expect(pathname + search + hash).toBe(
      '/profile/orders/100000000000000000000003?view=recent#details'
    );
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('при завершении сессии удаляет окно и разблокирует страницу входа', async () => {
    mount('/profile/orders/100000000000000000000003');
    await screen.findByRole('dialog');
    act(() => {
      store.dispatch(sessionEnded());
    });
    await screen.findByRole('heading', { name: 'Вход' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().modal.type).toBe('closed');
    expect(document.getElementById('root')?.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});
