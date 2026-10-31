import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@components/app/app';
import { ProfileLayout } from '@components/profile-layout/profile-layout';
import { ProtectedRoute } from '@components/protected-route/protected-route';
import { getReturnTo } from '@components/protected-route/return-to';
import { LoginPage } from '@pages/login/login';
import { ProfilePage } from '@pages/profile/profile';
import { RegisterPage } from '@pages/register/register';
import { burgerApi } from '@services/api/burger-api';
import {
  sessionEnded,
  sessionEstablished,
  sessionFailed,
} from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import { saveTokens } from '@services/auth/token-storage';
import { createTestStore } from '@services/store-test-utils';

const user = { name: 'Тест', email: 'test@example.test' };
const authResponse = {
  success: true,
  user,
  accessToken: 'Bearer test',
  refreshToken: 'refresh',
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('формы и защищённые маршруты', () => {
  let app: ReturnType<typeof createTestStore>;
  let requests: Request[];
  let respond: (request: Request) => Response | Promise<Response>;
  const mount = (
    path: string,
    withApp = false
  ): ReturnType<typeof createMemoryRouter> => {
    const router = createMemoryRouter(
      [
        {
          element: withApp ? <App /> : undefined,
          children: [
            { path: '/', element: <h1>Главная</h1> },
            { path: '/feed', element: <h1>Лента</h1> },
            { path: '/ingredients/:id', element: <h1>Ингредиент</h1> },
            {
              element: <ProtectedRoute />,
              children: [
                {
                  path: '/profile',
                  element: <ProfileLayout />,
                  children: [
                    { index: true, element: <ProfilePage /> },
                    { path: 'orders', element: <h1>История заказов</h1> },
                  ],
                },
              ],
            },
            {
              element: <ProtectedRoute onlyGuest />,
              children: [
                { path: '/login', element: <LoginPage /> },
                { path: '/register', element: <RegisterPage /> },
                { path: '/forgot-password', element: <h1>Восстановление</h1> },
                { path: '/reset-password', element: <h1>Сброс</h1> },
              ],
            },
            { path: '*', element: <h1>404</h1> },
          ],
        },
      ],
      { initialEntries: [path] }
    );
    render(
      <StrictMode>
        <Provider store={app}>
          <RouterProvider router={router} />
        </Provider>
      </StrictMode>
    );
    return router;
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    // В jsdom AbortSignal относится к DOM, а Request предоставлен Node/undici.
    // Отмена HTTP проверяется отдельно в Node API-тестах; здесь fetch всегда подменён.
    const NativeRequest = Request;
    vi.stubGlobal(
      'Request',
      class extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(input, { ...init, signal: undefined });
        }
      }
    );
    app = createTestStore();
    requests = [];
    respond = (request): Response | Promise<Response> =>
      request.url.endsWith('auth/user')
        ? json({ success: true, user })
        : request.url.endsWith('auth/logout')
          ? json({ success: true, message: 'Successful logout' })
          : json(authResponse);
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
    cleanup();
    app.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const fill = async (registration = false): Promise<void> => {
    if (registration) await userEvent.type(screen.getByLabelText('Имя'), 'Тест');
    await userEvent.type(screen.getByLabelText('E-mail'), user.email);
    await userEvent.type(screen.getByLabelText('Пароль'), 'test-password');
  };

  it('возвращает с входа на вложенный профиль с query/hash и показывает пользователя', async () => {
    app.dispatch(sessionEnded());
    const router = mount('/profile?view=recent#fields');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByDisplayValue(user.email);
    expect(
      router.state.location.pathname +
        router.state.location.search +
        router.state.location.hash
    ).toBe('/profile?view=recent#fields');
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(localStorage.getItem('accessToken')).toBe(authResponse.accessToken);
  });

  it('сохраняет назначение при переходе между входом и регистрацией', async () => {
    app.dispatch(sessionEnded());
    const router = mount('/profile/orders?view=recent#list');
    await userEvent.click(
      await screen.findByRole('link', { name: 'Зарегистрироваться' })
    );
    await userEvent.click(screen.getByRole('link', { name: 'Войти' }));
    await userEvent.click(screen.getByRole('link', { name: 'Зарегистрироваться' }));
    await fill(true);
    await userEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    await screen.findByRole('heading', { name: 'История заказов' });
    expect(
      router.state.location.pathname +
        router.state.location.search +
        router.state.location.hash
    ).toBe('/profile/orders?view=recent#list');
    expect(requests[0].url).toContain('auth/register');
  });

  it.each(['/login', '/register', '/forgot-password', '/reset-password'])(
    'перенаправляет авторизованного пользователя с %s',
    async (path) => {
      app.dispatch(sessionEstablished(user));
      const router = mount(path);
      await screen.findByRole('heading', { name: 'Главная' });
      expect(router.state.location.pathname).toBe('/');
    }
  );

  it.each(['/login', '/register'])(
    'открывает главную после самостоятельного входа/регистрации %s',
    async (path) => {
      app.dispatch(sessionEnded());
      mount(path);
      await fill(path === '/register');
      await userEvent.click(
        screen.getByRole('button', {
          name: path === '/login' ? 'Войти' : 'Зарегистрироваться',
        })
      );
      await screen.findByRole('heading', { name: 'Главная' });
    }
  );

  it('требует пароль регистрации, но отправляет непустой короткий пароль в API', async () => {
    app.dispatch(sessionEnded());
    mount('/register');
    await userEvent.type(screen.getByLabelText('Имя'), user.name);
    await userEvent.type(screen.getByLabelText('E-mail'), user.email);
    const password = screen.getByLabelText('Пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    expect(password).toBeInvalid();
    expect(requests).toHaveLength(0);
    respond = (): Response => json({ success: false }, 400);
    await userEvent.type(password, 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось зарегистрироваться'
    );
    expect(requests).toHaveLength(1);
    expect(await requests[0].json()).toEqual({ ...user, password: 'a' });
  });

  it.each([401, 500, 200])(
    'показывает ошибку входа и позволяет повторить (%s)',
    async (status) => {
      app.dispatch(sessionEnded());
      mount('/login');
      respond = (): Response | Promise<Response> => json({ success: false }, status);
      await fill();
      await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Не удалось войти');
      expect(alert).not.toHaveFocus();
      expect(alert).not.toHaveAttribute('tabindex');
      expect(requests).toHaveLength(1);
      respond = (): Response | Promise<Response> => json(authResponse);
      await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
      await screen.findByRole('heading', { name: 'Главная' });
    }
  );

  it.each(['/login', '/register'])(
    'сохраняет фокус поля после ошибки отправки через Enter на %s',
    async (path) => {
      app.dispatch(sessionEnded());
      mount(path);
      respond = (): Response => json({ success: false }, 401);
      await fill(path === '/register');
      const password = screen.getByLabelText('Пароль');
      expect(password).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      const alert = await screen.findByRole('alert');
      expect(alert).not.toHaveFocus();
      expect(alert).not.toHaveAttribute('tabindex');
      expect(password).toHaveFocus();
      expect(password).toHaveValue('test-password');
      const submit = screen.getByRole('button', {
        name: path === '/login' ? 'Войти' : 'Зарегистрироваться',
      });
      await userEvent.tab();
      expect(submit).toHaveFocus();
      await userEvent.tab();
      expect(
        screen.getByRole('link', {
          name: path === '/login' ? 'Зарегистрироваться' : 'Войти',
        })
      ).toHaveFocus();
      respond = (): Response => json(authResponse);
      await userEvent.tab({ shift: true });
      await userEvent.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Главная' });
    }
  );

  it('не фокусирует ошибку выхода при активации кнопки клавиатурой', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    respond = (): Response => json({}, 503);
    screen.getByRole('button', { name: 'Выход' }).focus();
    await userEvent.keyboard('{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveFocus();
    expect(alert).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('button', { name: 'Выход' })).toBeEnabled();
  });

  it('блокирует два быстрых submit и повторно разрешает отправку после ошибки', async () => {
    app.dispatch(sessionEnded());
    mount('/login');
    await fill();
    await userEvent.tab();
    let finish!: (value: Response) => void;
    respond = (): Response | Promise<Response> =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const form = screen.getByRole('form', { name: 'Вход' });
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
      await Promise.resolve();
    });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Входим…' })).toBeDisabled();
    await act(async () => {
      finish(json({}, 500));
      await Promise.resolve();
    });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
  });

  it('проверяет сессию из App в StrictMode без показа формы и дублирующего запроса', async () => {
    saveTokens(authResponse);
    const router = mount('/profile', true);
    expect(screen.getByText('Проверяем сессию…')).toBeVisible();
    expect(screen.queryByRole('form', { name: 'Вход' })).not.toBeInTheDocument();
    await screen.findByDisplayValue(user.email);
    expect(requests).toHaveLength(1);
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('при ошибке проверки сохраняет URL и токены, повтор восстанавливает профиль', async () => {
    saveTokens(authResponse);
    respond = (): Response | Promise<Response> => {
      throw new TypeError('Offline');
    };
    const router = mount('/profile', true);
    await screen.findByRole('button', { name: 'Повторить проверку' });
    expect(router.state.location.pathname).toBe('/profile');
    expect(localStorage.getItem('refreshToken')).toBe('refresh');
    respond = (): Response | Promise<Response> => json({ success: true, user });
    await userEvent.click(screen.getByRole('button', { name: 'Повторить проверку' }));
    await screen.findByDisplayValue(user.email);
  });

  it('выход сохраняет сессию при ошибке и уводит на главную после успешного повтора', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    respond = (): Response | Promise<Response> => json({}, 500);
    await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Не удалось выйти');
    expect(alert).not.toHaveFocus();
    expect(alert).not.toHaveAttribute('tabindex');
    expect(localStorage.getItem('refreshToken')).toBe('refresh');
    respond = (): Response | Promise<Response> =>
      json({ success: true, message: 'Successful logout' });
    await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
    await screen.findByRole('heading', { name: 'Главная' });
    expect(app.getState().auth.user).toBeNull();
  });

  it('не отправляет локальные изменения профиля', () => {
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    expect(screen.getByLabelText('Имя')).toHaveValue(user.name);
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Черновик' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Профиль' }));
    expect(requests).toHaveLength(0);
  });

  it('после выхода и входа другим пользователем показывает новые данные без старого черновика', async () => {
    app.dispatch(sessionEnded());
    mount('/profile', true);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByDisplayValue(user.email);
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Черновик' } });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'draft-password' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
    await screen.findByRole('heading', { name: 'Главная' });
    expect(screen.queryByRole('form', { name: 'Профиль' })).not.toBeInTheDocument();
    expect(app.getState().auth.user).toBeNull();
    const otherUser = { name: 'Другой', email: 'other@example.test' };
    respond = (): Response => json({ ...authResponse, user: otherUser });
    await userEvent.click(screen.getByRole('link', { name: 'Личный кабинет' }));
    await screen.findByRole('form', { name: 'Вход' });
    await userEvent.type(screen.getByLabelText('E-mail'), otherUser.email);
    await userEvent.type(screen.getByLabelText('Пароль'), 'other-password');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByDisplayValue(otherUser.email);
    expect(screen.getByLabelText('Имя')).toHaveValue(otherUser.name);
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(
      requests.filter((request) => request.url.endsWith('auth/login'))
    ).toHaveLength(2);
    expect(
      requests.filter((request) => request.url.endsWith('auth/logout'))
    ).toHaveLength(1);
  });

  it.each(['/', '/feed', '/ingredients/id', '/missing'])(
    'не блокирует публичный маршрут %s при неизвестной сессии',
    (path) => {
      mount(path);
      expect(screen.queryByText('Проверяем сессию…')).not.toBeInTheDocument();
      expect(screen.getByRole('heading')).toBeVisible();
    }
  );

  it('не показывает формы/профиль при ошибке чтения сессии', () => {
    app.dispatch(sessionFailed({ version: 0, message: 'Хранилище недоступно' }));
    mount('/login');
    expect(screen.getByRole('alert')).toHaveTextContent('Хранилище недоступно');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it.each([
    'https://example.test',
    '//example.test',
    '/login',
    '/profile/../login',
    '/profile\\evil',
  ])('отклоняет недопустимый адрес возврата %s', (pathname) => {
    expect(getReturnTo({ from: { pathname, search: '', hash: '' } })).toBe('/');
  });
});
