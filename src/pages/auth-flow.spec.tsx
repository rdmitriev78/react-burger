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

  const editProfileField = async (label: string): Promise<void> => {
    const icon = screen
      .getByLabelText(label)
      .parentElement?.querySelector('.input__icon');
    if (!icon) throw new Error(`Нет карандаша поля ${label}`);
    await userEvent.click(icon);
  };

  const changeProfileField = (label: string, value: string): void => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  };

  const profilePatchRequests = (): Request[] =>
    requests.filter((request) => request.method === 'PATCH');

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

  it.each(['/login', '/register'])(
    '%s: блокирует повторные клик и Enter во время запроса и разрешает повтор после ошибки',
    async (path) => {
      app.dispatch(sessionEnded());
      mount(path);
      await fill(path === '/register');
      let finish!: (value: Response) => void;
      respond = (): Response | Promise<Response> =>
        new Promise((resolve) => {
          finish = resolve;
        });
      const buttonName = path === '/login' ? 'Войти' : 'Зарегистрироваться';
      const button = screen.getByRole('button', { name: buttonName });
      await userEvent.dblClick(button);
      await userEvent.click(screen.getByLabelText('Пароль'));
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(button).toBeDisabled();
      await act(async () => {
        finish(json({}, 500));
        await Promise.resolve();
      });
      await screen.findByRole('alert');
      expect(button).toBeEnabled();
      respond = (): Response => json(authResponse);
      await userEvent.click(screen.getByRole('button', { name: buttonName }));
      await screen.findByRole('heading', { name: 'Главная' });
      expect(requests).toHaveLength(2);
    }
  );

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

  it.each(['/login', '/register'])(
    'ошибка записи токенов не подтверждает вход на %s',
    async (path) => {
      app.dispatch(sessionEnded());
      const router = mount(path);
      await fill(path === '/register');
      const writing = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Denied');
      });
      fireEvent.submit(screen.getByRole('form'));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Не удалось прочитать или сохранить сессию'
      );
      expect(app.getState().auth.status).toBe('anonymous');
      expect(app.getState().auth.user).toBeNull();
      expect(router.state.location.pathname).toBe(path);
      writing.mockRestore();
      await userEvent.click(
        screen.getByRole('button', {
          name: path === '/login' ? 'Войти' : 'Зарегистрироваться',
        })
      );
      await screen.findByRole('heading', { name: 'Главная' });
    }
  );

  it('logout блокирует быстрые дубли и сохраняет ожидание после возврата', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    const router = mount('/profile');
    let finish!: (response: Response) => void;
    respond = (): Promise<Response> =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const button = screen.getByRole('button', { name: 'Выход' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(() => router.navigate('/feed'));
    await act(() => router.navigate('/profile'));
    const waiting = screen.getByRole('button', { name: 'Выходим…' });
    expect(waiting).toBeDisabled();
    fireEvent.click(waiting);
    expect(requests).toHaveLength(1);
    await act(async () => {
      finish(json({ success: true, message: 'Logged out' }));
      await Promise.resolve();
    });
    await screen.findByRole('heading', { name: 'Главная' });
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('успешный выход завершает переход на лениво загружаемую главную', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    let loadHome!: () => void;
    const home = new Promise<void>((resolve) => {
      loadHome = resolve;
    });
    const router = createMemoryRouter(
      [
        {
          path: '/',
          lazy: async (): Promise<{ Component: () => React.JSX.Element }> => {
            await home;
            return { Component: (): React.JSX.Element => <h1>Главная</h1> };
          },
        },
        {
          element: <ProtectedRoute />,
          children: [
            {
              path: '/profile',
              element: <ProfileLayout />,
              children: [{ index: true, element: <ProfilePage /> }],
            },
          ],
        },
        { path: '/login', element: <h1>Вход</h1> },
      ],
      { initialEntries: ['/profile'] }
    );
    render(
      <Provider store={app}>
        <RouterProvider router={router} />
      </Provider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
    await waitFor(() => expect(router.state.navigation.location?.pathname).toBe('/'));
    expect(app.getState().auth.status).toBe('anonymous');
    expect(localStorage.getItem('accessToken')).toBeNull();
    await act(async () => {
      loadHome();
      await home;
    });
    await screen.findByRole('heading', { name: 'Главная' });
    expect(router.state.location.pathname).toBe('/');
  });

  it.each(['read', 'clear'])(
    'ошибка хранилища %s не объявляет успешный выход',
    async (stage) => {
      saveTokens(authResponse);
      app.dispatch(sessionEstablished(user));
      const router = mount('/profile');
      vi.spyOn(
        localStorage,
        stage === 'read' ? 'getItem' : 'removeItem'
      ).mockImplementation(() => {
        throw new Error('Denied');
      });
      await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выйти');
      expect(router.state.location.pathname).toBe('/profile');
      expect(app.getState().auth.status).toBe('authenticated');
      expect(screen.getByRole('button', { name: 'Выход' })).toBeEnabled();
    }
  );

  it('карандаш включает режим формы, смена поля и blur сохраняют черновик и кнопки', async () => {
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    expect(screen.getByLabelText('Имя')).toHaveValue(user.name);
    expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
    await editProfileField('Имя');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeVisible();
    changeProfileField('Имя', 'Черновик');
    await editProfileField('Логин');
    expect(screen.getByLabelText('Имя')).toHaveValue('Черновик');
    expect(screen.getByLabelText('Имя')).toHaveAttribute('readonly');
    fireEvent.blur(screen.getByLabelText('Логин'));
    expect(screen.getByLabelText('Логин')).toHaveAttribute('readonly');
    await editProfileField('Имя');
    changeProfileField('Имя', user.name);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  it('отмена сбрасывает все поля без запроса и завершает режим формы', async () => {
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    await editProfileField('Имя');
    changeProfileField('Имя', 'Черновик');
    await editProfileField('Логин');
    changeProfileField('Логин', 'draft@example.test');
    await editProfileField('Пароль');
    changeProfileField('Пароль', 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByLabelText('Имя')).toHaveValue(user.name);
    expect(screen.getByLabelText('Логин')).toHaveValue(user.email);
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it.each(['', 'x'])(
    'сохраняет профиль из ответа, пароль=%j; следующая отмена использует новые значения',
    async (password) => {
      saveTokens(authResponse);
      app.dispatch(sessionEstablished(user));
      const router = mount('/profile');
      const confirmed = { name: 'Серверное имя', email: 'canonical@example.test' };
      respond = (): Response => json({ success: true, user: confirmed });
      await editProfileField('Имя');
      changeProfileField('Имя', 'Новое имя');
      if (password) {
        await editProfileField('Пароль');
        changeProfileField('Пароль', password);
      }
      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Сохранить' })
        ).not.toBeInTheDocument()
      );
      expect(await profilePatchRequests()[0].json()).toEqual({
        ...user,
        name: 'Новое имя',
        password,
      });
      expect(app.getState().auth.user).toEqual(confirmed);
      expect(screen.getByLabelText('Имя')).toHaveValue(confirmed.name);
      expect(screen.getByLabelText('Пароль')).toHaveValue('');
      await editProfileField('Имя');
      changeProfileField('Имя', 'Следующий черновик');
      await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
      expect(screen.getByLabelText('Имя')).toHaveValue(confirmed.name);
      await act(() => router.navigate('/profile/orders'));
      await act(() => router.navigate('/profile'));
      expect(screen.getByLabelText('Логин')).toHaveValue(confirmed.email);
      expect(screen.getByLabelText('Пароль')).toHaveValue('');
      expect(profilePatchRequests()).toHaveLength(1);
    }
  );

  it.each([false, true])(
    'отправляет неизменённые значения, ручной возврат=%s',
    async (revert) => {
      saveTokens(authResponse);
      app.dispatch(sessionEstablished(user));
      mount('/profile');
      await editProfileField('Имя');
      if (revert) {
        changeProfileField('Имя', 'Черновик');
        changeProfileField('Имя', user.name);
      }
      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => expect(profilePatchRequests()).toHaveLength(1));
      expect(await profilePatchRequests()[0].json()).toEqual({ ...user, password: '' });
    }
  );

  it('ошибка сохраняет черновик и пароль без фокуса; повтор очищает ошибку, отмена удаляет черновик', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    respond = (): Response => json({}, 500);
    await editProfileField('Имя');
    changeProfileField('Имя', 'Черновик');
    await editProfileField('Пароль');
    changeProfileField('Пароль', 'x');
    await userEvent.keyboard('{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Не удалось сохранить изменения. Повторите попытку.'
    );
    expect(alert).not.toHaveFocus();
    expect(alert).not.toHaveAttribute('tabindex');
    expect(screen.getByLabelText('Имя')).toHaveValue('Черновик');
    expect(screen.getByLabelText('Пароль')).toHaveValue('x');
    expect(app.getState().auth.user).toEqual(user);
    let finish!: (response: Response) => void;
    respond = (): Promise<Response> =>
      new Promise((resolve) => {
        finish = resolve;
      });
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(profilePatchRequests()).toHaveLength(2));
    await act(async () => {
      finish(json({ success: false }));
      await Promise.resolve();
    });
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(screen.getByLabelText('Имя')).toHaveValue(user.name);
  });

  it('блокирует поля, карандаши, обе кнопки и повторные действия во время PATCH', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    mount('/profile');
    let finish!: (response: Response) => void;
    respond = (): Promise<Response> =>
      new Promise((resolve) => {
        finish = resolve;
      });
    await editProfileField('Имя');
    changeProfileField('Имя', 'Черновик');
    const form = screen.getByRole('form', { name: 'Профиль' });
    await userEvent.dblClick(screen.getByRole('button', { name: 'Сохранить' }));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(profilePatchRequests()).toHaveLength(1));
    expect(form).toHaveAttribute('aria-busy', 'true');
    for (const label of ['Имя', 'Логин', 'Пароль'])
      expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
    await editProfileField('Логин');
    expect(screen.getByLabelText('Имя')).toHaveValue('Черновик');
    await act(async () => {
      finish(json({}, 500));
      await Promise.resolve();
    });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeEnabled();
    expect(screen.getByLabelText('Имя')).toBeEnabled();
  });

  it.each([false, true])(
    'уход не отменяет PATCH, возврат до ответа=%s',
    async (reopenBeforeResponse) => {
      saveTokens(authResponse);
      app.dispatch(sessionEstablished(user));
      const router = mount('/profile');
      let finish!: (response: Response) => void;
      respond = (): Promise<Response> =>
        new Promise((resolve) => {
          finish = resolve;
        });
      await editProfileField('Имя');
      changeProfileField('Имя', 'Черновик');
      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => expect(profilePatchRequests()).toHaveLength(1));
      await userEvent.click(screen.getByRole('link', { name: 'История заказов' }));
      if (reopenBeforeResponse) {
        await userEvent.click(screen.getByRole('link', { name: 'Профиль' }));
        expect(screen.getByRole('status')).toHaveTextContent('Сохраняем…');
        expect(screen.getByLabelText('Имя')).toBeDisabled();
        await editProfileField('Имя');
        await userEvent.click(screen.getByLabelText('Имя'));
        await userEvent.keyboard('{Enter}');
      }
      const confirmed = { ...user, name: 'Подтверждённое' };
      await act(async () => {
        finish(json({ success: true, user: confirmed }));
        await Promise.resolve();
      });
      await waitFor(() => expect(app.getState().auth.user).toEqual(confirmed));
      if (!reopenBeforeResponse) {
        expect(router.state.location.pathname).toBe('/profile/orders');
        await act(() => router.navigate('/profile'));
      }
      expect(screen.getByLabelText('Имя')).toHaveValue(confirmed.name);
      expect(screen.getByLabelText('Пароль')).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: 'Сохранить' })
      ).not.toBeInTheDocument();
      expect(profilePatchRequests()).toHaveLength(1);
    }
  );

  it('после выхода и входа другим пользователем показывает новые данные без старого черновика', async () => {
    app.dispatch(sessionEnded());
    mount('/profile', true);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByDisplayValue(user.email);
    await editProfileField('Имя');
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Черновик' } });
    await editProfileField('Пароль');
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

  it.each([
    { first: 'login', status: 200 },
    { first: 'login', status: 500 },
    { first: 'register', status: 200 },
    { first: 'register', status: 500 },
  ])(
    'уход с $first отменяет её поздний результат ($status)',
    async ({ first, status }) => {
      app.dispatch(sessionEnded());
      let finish!: (response: Response) => void;
      const pending = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const otherUser = { name: 'Другой', email: 'other@example.test' };
      respond = (request): Response | Promise<Response> =>
        request.url.endsWith(`auth/${first}`)
          ? pending
          : json({
              ...authResponse,
              user: otherUser,
              accessToken: 'Bearer other',
              refreshToken: 'other-refresh',
            });
      const router = mount(`/${first}`);
      await fill(first === 'register');
      await userEvent.click(
        screen.getByRole('button', {
          name: first === 'login' ? 'Войти' : 'Зарегистрироваться',
        })
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      await userEvent.click(
        screen.getByRole('link', {
          name: first === 'login' ? 'Зарегистрироваться' : 'Войти',
        })
      );
      await fill(first === 'login');
      await userEvent.click(
        screen.getByRole('button', {
          name: first === 'login' ? 'Зарегистрироваться' : 'Войти',
        })
      );
      await screen.findByRole('heading', { name: 'Главная' });
      expect(app.getState().auth.user).toEqual(otherUser);
      await act(async () => {
        finish(json(authResponse, status));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(app.getState().auth.user).toEqual(otherUser);
      expect(localStorage.getItem('accessToken')).toBe('Bearer other');
      expect(router.state.location.pathname).toBe('/');
    }
  );

  it.each([200, 500])(
    'старый PATCH не блокирует новую форму и не меняет её pending (%s)',
    async (status) => {
      saveTokens(authResponse);
      app.dispatch(sessionEstablished(user));
      let finishOld!: (response: Response) => void;
      let finishNew!: (response: Response) => void;
      const oldPatch = new Promise<Response>((resolve) => {
        finishOld = resolve;
      });
      const newPatch = new Promise<Response>((resolve) => {
        finishNew = resolve;
      });
      const other = { name: 'Другой', email: 'other@example.test' };
      respond = (request): Response | Promise<Response> =>
        request.method === 'PATCH'
          ? profilePatchRequests().length === 1
            ? oldPatch
            : newPatch
          : request.url.endsWith('auth/logout')
            ? json({ success: true, message: 'Successful logout' })
            : json({
                ...authResponse,
                user: other,
                accessToken: 'Bearer other',
                refreshToken: 'other-refresh',
              });
      const router = mount('/profile');
      await editProfileField('Имя');
      changeProfileField('Имя', 'Черновик A');
      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => expect(profilePatchRequests()).toHaveLength(1));
      await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
      await screen.findByRole('heading', { name: 'Главная' });
      await act(() => router.navigate('/login'));
      await fill();
      await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
      await screen.findByRole('heading', { name: 'Главная' });
      await act(() => router.navigate('/profile'));
      expect(screen.getByLabelText('Имя')).toHaveValue(other.name);
      expect(screen.getByLabelText('Имя')).not.toBeDisabled();
      await editProfileField('Имя');
      changeProfileField('Имя', 'Новое B');
      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => expect(profilePatchRequests()).toHaveLength(2));
      await act(async () => {
        finishOld(json({ success: true, user }, status));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(app.getState().auth.user).toEqual(other);
      expect(screen.getByLabelText('Имя')).toHaveValue('Новое B');
      expect(screen.getByLabelText('Имя')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
      act(() => {
        finishNew(json({ success: true, user: { ...other, name: 'Новое B' } }));
      });
      await waitFor(() => expect(screen.getByLabelText('Имя')).not.toBeDisabled());
      expect(app.getState().auth.user?.name).toBe('Новое B');
      expect(localStorage.getItem('accessToken')).toBe('Bearer other');
    }
  );

  it.each([
    { path: '/login', status: 200 },
    { path: '/login', status: 500 },
    { path: '/register', status: 200 },
    { path: '/register', status: 500 },
  ])(
    'уход с $path без другой попытки исключает позднюю авторизацию ($status)',
    async ({ path, status }) => {
      app.dispatch(sessionEnded());
      let finish!: (response: Response) => void;
      respond = (): Response | Promise<Response> =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        });
      const router = mount(path);
      await fill(path === '/register');
      await userEvent.click(
        screen.getByRole('button', {
          name: path === '/register' ? 'Зарегистрироваться' : 'Войти',
        })
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      await act(() => router.navigate('/feed'));
      await act(async () => {
        finish(json(authResponse, status));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(app.getState().auth.status).toBe('anonymous');
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(router.state.location.pathname).toBe('/feed');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );

  it('старый logout не блокирует новый и не сбрасывает его ожидание', async () => {
    saveTokens(authResponse);
    app.dispatch(sessionEstablished(user));
    let finishOld!: (response: Response) => void;
    let finishNew!: (response: Response) => void;
    const oldLogout = new Promise<Response>((resolve) => {
      finishOld = resolve;
    });
    const newLogout = new Promise<Response>((resolve) => {
      finishNew = resolve;
    });
    respond = (): Response | Promise<Response> =>
      requests.length === 1 ? oldLogout : newLogout;
    const router = mount('/profile');
    await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(() => router.navigate('/feed'));
    act(() => {
      // Подтверждённое завершение другим запросом; сетевой сценарий проверяется в браузере.
      app.dispatch(sessionEnded());
      saveTokens({ accessToken: 'Bearer other', refreshToken: 'other-refresh' });
      app.dispatch(sessionEstablished({ name: 'Другой', email: 'other@example.test' }));
    });
    await act(() => router.navigate('/profile'));
    expect(screen.getByRole('button', { name: 'Выход' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => {
      finishOld(json({ success: true, message: 'Successful logout' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('button', { name: 'Выходим…' })).toBeDisabled();
    expect(router.state.location.pathname).toBe('/profile');
    expect(localStorage.getItem('accessToken')).toBe('Bearer other');
    act(() => {
      finishNew(json({ success: true, message: 'Successful logout' }));
    });
    await screen.findByRole('heading', { name: 'Главная' });
    expect(app.getState().auth.status).toBe('anonymous');
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
    app.dispatch(sessionFailed('Хранилище недоступно'));
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
