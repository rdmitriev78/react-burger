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
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@components/protected-route/protected-route';
import { ForgotPasswordPage } from '@pages/forgot-password/forgot-password';
import { LoginPage } from '@pages/login/login';
import { ResetPasswordPage } from '@pages/reset-password/reset-password';
import { burgerApi } from '@services/api/burger-api';
import {
  checkingSession,
  sessionEnded,
  sessionEstablished,
} from '@services/auth/auth-slice';
import { createTestStorage } from '@services/auth/auth-test-utils';
import {
  hasPasswordResetRequest,
  markPasswordResetRequested,
} from '@services/password-recovery/password-recovery-storage';
import { createTestStore } from '@services/store-test-utils';

const email = 'recovery@example.test';
const code = ' 001-AbC ';
const json = (
  body: unknown = { success: true, message: 'Подтверждено' },
  status = 200
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const deferred = (): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('восстановление и сброс пароля', () => {
  let app: ReturnType<typeof createTestStore>;
  let requests: Request[];
  let respond: () => Response | Promise<Response>;
  let user: ReturnType<typeof userEvent.setup>;

  const mount = (path: string): ReturnType<typeof createMemoryRouter> => {
    const router = createMemoryRouter(
      [
        {
          element: (
            <>
              <Link to="/">На главную</Link>
              <Outlet />
            </>
          ),
          children: [
            { path: '/', element: <h1>Главная</h1> },
            {
              element: <ProtectedRoute onlyGuest />,
              children: [
                { path: '/forgot-password', element: <ForgotPasswordPage /> },
                { path: '/reset-password', element: <ResetPasswordPage /> },
                { path: '/login', element: <LoginPage /> },
              ],
            },
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
  const fillEmail = (value = email): void => {
    fireEvent.change(screen.getByLabelText('Укажите e-mail'), { target: { value } });
  };
  const fillReset = (password = 'x', token = code): void => {
    fireEvent.change(screen.getByLabelText('Введите новый пароль'), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText('Введите код из письма'), {
      target: { value: token },
    });
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestStorage());
    // jsdom и Node Request используют разные классы AbortSignal.
    // HTTP-отмена проверяется в браузере; здесь проверяем последствия позднего ответа.
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
    app.dispatch(sessionEnded());
    user = userEvent.setup();
    requests = [];
    respond = (): Response => json();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        requests.push(new Request(input));
        return Promise.resolve(respond());
      })
    );
  });
  afterEach(() => {
    cleanup();
    app.dispatch(burgerApi.util.resetApiState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('проводит полный путь письма и сброса с коротким паролем без автоматического входа', async () => {
    const router = mount('/forgot-password');
    fillEmail();
    await user.click(screen.getByRole('button', { name: 'Восстановить' }));
    await screen.findByLabelText('Введите код из письма');
    expect(router.state.location.pathname).toBe('/reset-password');
    expect(hasPasswordResetRequest()).toBe(true);
    expect(await requests[0].json()).toEqual({ email });
    expect(screen.getByLabelText('Введите новый пароль')).not.toHaveAttribute(
      'minlength'
    );
    fillReset();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByRole('heading', { name: 'Вход' });
    expect(router.state.location.pathname).toBe('/login');
    expect(hasPasswordResetRequest()).toBe(false);
    expect(await requests[1].json()).toEqual({ password: 'x', token: code });
    expect(app.getState().auth.status).toBe('anonymous');
    expect(localStorage.length).toBe(0);
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(screen.getByLabelText('E-mail')).toHaveValue('');
    await act(async () => {
      await router.navigate('/reset-password');
    });
    await screen.findByLabelText('Укажите e-mail');
    expect(router.state.location.pathname).toBe('/forgot-password');
  });

  it.each(['', 'incorrect'])('не отправляет неправильный email %j', async (value) => {
    mount('/forgot-password');
    fillEmail(value);
    await user.click(screen.getByRole('button', { name: 'Восстановить' }));
    expect(requests).toHaveLength(0);
    expect(hasPasswordResetRequest()).toBe(false);
  });

  it.each([
    ['', code],
    ['x', ''],
  ])('требует пароль и код: %j / %j', async (password, token) => {
    markPasswordResetRequested();
    mount('/reset-password');
    fillReset(password, token);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(requests).toHaveLength(0);
  });

  it.each([null, 'false', '1'])(
    'закрывает прямой вход на сброс при флаге %j',
    async (value) => {
      if (value !== null) localStorage.setItem('passwordResetRequested', value);
      const router = mount('/reset-password');
      await screen.findByLabelText('Укажите e-mail');
      expect(router.state.location.pathname).toBe('/forgot-password');
      expect(screen.queryByLabelText('Введите код из письма')).not.toBeInTheDocument();
      expect(requests).toHaveLength(0);
    }
  );

  it('сохраняет доступ после повторного монтирования и не удерживает на странице', async () => {
    markPasswordResetRequested();
    const first = mount('/reset-password');
    expect(screen.getByLabelText('Введите код из письма')).toHaveValue('');
    await user.click(screen.getByRole('link', { name: 'На главную' }));
    expect(first.state.location.pathname).toBe('/');
    expect(hasPasswordResetRequest()).toBe(true);
    cleanup();
    const second = mount('/reset-password');
    expect(second.state.location.pathname).toBe('/reset-password');
    expect(screen.getByLabelText('Введите новый пароль')).toHaveValue('');
    expect(requests).toHaveLength(0);
  });

  it('позволяет запросить письмо снова и сохраняет флаг после ошибки нового запроса', async () => {
    markPasswordResetRequested();
    const router = mount('/reset-password');
    const resend = screen.getByRole('link', {
      name: 'Не пришло письмо? Запросить ещё раз',
    });
    act(() => resend.focus());
    await user.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/forgot-password');
    expect(screen.getByLabelText('Укажите e-mail')).toHaveValue('');
    expect(hasPasswordResetRequest()).toBe(true);
    expect(requests).toHaveLength(0);
    fillEmail('other@example.test');
    await user.click(screen.getByRole('button', { name: 'Восстановить' }));
    await screen.findByLabelText('Введите код из письма');
    expect(requests).toHaveLength(1);
    expect(await requests[0].json()).toEqual({ email: 'other@example.test' });
    await user.click(
      screen.getByRole('link', { name: 'Не пришло письмо? Запросить ещё раз' })
    );
    respond = (): Response => json({ success: false }, 400);
    fillEmail();
    await user.click(screen.getByRole('button', { name: 'Восстановить' }));
    await screen.findByRole('alert');
    expect(router.state.location.pathname).toBe('/forgot-password');
    expect(hasPasswordResetRequest()).toBe(true);
    expect(screen.getByLabelText('Укажите e-mail')).toHaveValue(email);
    expect(requests).toHaveLength(2);
    await act(async () => {
      await router.navigate('/reset-password');
    });
    expect(screen.getByLabelText('Введите код из письма')).toBeInTheDocument();
  });

  it.each(['/forgot-password', '/reset-password'])(
    'не показывает %s вошедшему пользователю с флагом',
    (path) => {
      markPasswordResetRequested();
      app.dispatch(sessionEstablished({ name: 'Тест', email }));
      const router = mount(path);
      expect(router.state.location.pathname).toBe('/');
      expect(screen.getByRole('heading', { name: 'Главная' })).toBeInTheDocument();
      expect(requests).toHaveLength(0);
    }
  );

  it('не показывает форму до завершения проверки сессии', () => {
    markPasswordResetRequested();
    app.dispatch(checkingSession());
    mount('/reset-password');
    expect(screen.getByText('Проверяем сессию…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Введите код из письма')).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'повторяет чтение хранилища, фактический флаг: %s',
    async (allowed) => {
      if (allowed) markPasswordResetRequested();
      const read = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('Denied');
      });
      const router = mount('/reset-password');
      expect(screen.getByRole('alert')).toHaveTextContent('Не удалось проверить');
      expect(router.state.location.pathname).toBe('/reset-password');
      expect(screen.queryByLabelText('Введите код из письма')).not.toBeInTheDocument();
      read.mockRestore();
      await user.click(screen.getByRole('button', { name: 'Повторить проверку' }));
      expect(
        screen.getByLabelText(allowed ? 'Введите код из письма' : 'Укажите e-mail')
      ).toBeInTheDocument();
      expect(requests).toHaveLength(0);
    }
  );

  describe.each([false, true])('отправка формы сброса: %s', (isReset) => {
    const prepare = (): ReturnType<typeof createMemoryRouter> => {
      if (isReset) markPasswordResetRequested();
      const router = mount(isReset ? '/reset-password' : '/forgot-password');
      if (isReset) fillReset();
      else fillEmail();
      return router;
    };
    const button = (): HTMLElement =>
      screen.getByRole('button', { name: isReset ? 'Сохранить' : 'Восстановить' });

    it.each([401, 500, 200])(
      'оставляет поля и позволяет повтор после HTTP %s',
      async (status) => {
        const router = prepare();
        respond = (): Response => json({ success: false }, status);
        await user.click(button());
        const alert = await screen.findByRole('alert');
        expect(alert).not.toHaveAttribute('tabindex');
        expect(alert).not.toHaveFocus();
        expect(
          screen.getByLabelText(isReset ? 'Введите код из письма' : 'Укажите e-mail')
        ).toHaveValue(isReset ? code : email);
        expect(hasPasswordResetRequest()).toBe(isReset);
        expect(requests).toHaveLength(1);
        respond = (): Response => json();
        await user.click(button());
        await waitFor(() =>
          expect(router.state.location.pathname).toBe(
            isReset ? '/login' : '/reset-password'
          )
        );
        expect(requests).toHaveLength(2);
      }
    );

    it('сохраняет фокус при ошибке после Enter', async () => {
      prepare();
      respond = (): Response => json({ success: false }, 400);
      const field = screen.getByLabelText(
        isReset ? 'Введите код из письма' : 'Укажите e-mail'
      );
      await user.click(field);
      await user.keyboard('{Enter}');
      await screen.findByRole('alert');
      expect(field).toHaveFocus();
      expect(requests).toHaveLength(1);
    });

    it('блокирует повторные клик и Enter во время запроса', async () => {
      const router = prepare();
      const pending = deferred();
      respond = (): Promise<Response> => pending.promise;
      await user.dblClick(button());
      await user.click(
        screen.getByLabelText(isReset ? 'Введите код из письма' : 'Укажите e-mail')
      );
      await user.keyboard('{Enter}');
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(
        screen.getByRole('button', { name: isReset ? 'Сохраняем…' : 'Отправляем…' })
      ).toBeDisabled();
      await act(async () => {
        pending.resolve(json());
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          isReset ? '/login' : '/reset-password'
        )
      );
      expect(requests).toHaveLength(1);
    });

    it.each([200, 500])(
      'не отменяет запрос и игнорирует поздний ответ после ухода (%s)',
      async (status) => {
        const router = prepare();
        const pending = deferred();
        respond = (): Promise<Response> => pending.promise;
        await user.click(button());
        await waitFor(() => expect(requests).toHaveLength(1));
        const [operation] = app.dispatch(burgerApi.util.getRunningMutationsThunk());
        const abort = vi.spyOn(operation, 'abort');
        await user.click(screen.getByRole('link', { name: 'На главную' }));
        expect(abort).not.toHaveBeenCalled();
        await act(async () => {
          pending.resolve(json(undefined, status));
          await Promise.resolve();
        });
        expect(router.state.location.pathname).toBe('/');
        expect(hasPasswordResetRequest()).toBe(isReset);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }
    );
  });

  it('повторяет запись флага без повторного письма после серверного успеха', async () => {
    const router = mount('/forgot-password');
    fillEmail();
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    await user.click(screen.getByRole('button', { name: 'Восстановить' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Укажите e-mail')).toHaveAttribute('readonly');
    expect(router.state.location.pathname).toBe('/forgot-password');
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Повторить сохранение' }));
    await screen.findByLabelText('Введите код из письма');
    expect(requests).toHaveLength(1);
    expect(hasPasswordResetRequest()).toBe(true);
  });

  it('повторяет удаление флага без повторного сброса после серверного успеха', async () => {
    markPasswordResetRequested();
    const router = mount('/reset-password');
    fillReset();
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Введите код из письма')).toHaveAttribute('readonly');
    expect(router.state.location.pathname).toBe('/reset-password');
    remove.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Повторить завершение' }));
    await screen.findByRole('heading', { name: 'Вход' });
    expect(requests).toHaveLength(1);
    expect(hasPasswordResetRequest()).toBe(false);
  });
});
