import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@components/app/app';
import { FeedOrderModalRoute } from '@components/feed-order-modal-route/feed-order-modal-route';
import { IngredientModalRoute } from '@components/ingredient-modal-route/ingredient-modal-route';
import { FeedPage } from '@pages/feed/feed';
import { burgerApi } from '@services/api/burger-api';
import {
  checkingSession,
  sessionEstablished,
  sessionFailed,
} from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { createTestStore } from '@services/store-test-utils';
import { ingredients } from '@utils/ingredients';

describe('маршрутное окно ленты', () => {
  let store: ReturnType<typeof createTestStore>;
  let router: ReturnType<typeof createMemoryRouter>;
  let unsubscribe: (() => void) | undefined;

  const mount = (path = '/feed'): void => {
    router = createMemoryRouter(
      [
        {
          element: <App />,
          children: [
            {
              path: 'feed',
              element: <FeedPage />,
              children: [{ path: ':id', element: <FeedOrderModalRoute /> }],
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
    const card = screen.getByRole('link', { name: /Заказ #034533/ });
    card.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Информация о заказе' });
    expect(router.state.location.pathname).toBe('/feed/34533');
    expect(within(dialog).getByText('510')).toBeInTheDocument();
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
    mount('/feed/34534');
    const dialog = await screen.findByRole('dialog', { name: 'Информация о заказе' });
    expect(
      within(dialog).getByRole('heading', { name: 'Interstellar бургер' })
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByRole('link', { name: 'Лента заказов' })).toHaveFocus();
  });

  it('согласовывает окно с Back/Forward и сменой id, очищает его при уходе', async () => {
    mount();
    await userEvent.click(screen.getByRole('link', { name: /Заказ #034533/ }));
    await screen.findByRole('dialog');
    await act(() => router.navigate(-1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(() => router.navigate(1));
    expect(within(screen.getByRole('dialog')).getByText('#034533')).toBeInTheDocument();
    await act(() => router.navigate('/feed/34542'));
    expect(within(screen.getByRole('dialog')).getByText('#034542')).toBeInTheDocument();
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
    mount('/feed/34533');
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
      expect(router.state.location.pathname).toBe('/feed/34533');
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
});
