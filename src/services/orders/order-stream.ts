import { addListener, createAction } from '@reduxjs/toolkit';

import { endSession, refreshSession } from '@services/api/session-refresh';
import { sessionFailed } from '@services/auth/auth-slice';
import { isObject } from '@services/auth/auth.types';
import { readTokens, storageErrorMessage } from '@services/auth/token-storage';

import { parseOrderSnapshot } from './order-data';

import type { TOrderScope, TOrderStream } from '@app-types/order';
import type { TSessionApi } from '@services/api/session-refresh';
import type { AppDispatch } from '@services/store';

type TStreamApi = TSessionApi & {
  cacheDataLoaded: Promise<unknown>;
  cacheEntryRemoved: Promise<void>;
  updateCachedData: (recipe: (draft: TOrderStream) => void) => unknown;
};
type TSessionState = { auth: { version: number; status: string } };

export const retryOrderStream = createAction<TOrderScope>('orders/retryStream');

/**
 * Поддерживает WebSocket выбранной ленты в течение жизни записи кеша RTK Query:
 * обновляет снимок, восстанавливает связь/авторизацию и освобождает ресурсы.
 */
export const runOrderStream = async (
  scope: TOrderScope,
  api: TStreamApi
): Promise<void> => {
  // Lifecycle API стирает middleware-overload dispatch; оба store подключают listener middleware.
  const dispatch = api.dispatch as AppDispatch;
  let stopped = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1000;
  let authRetried = false;
  let recovery: Promise<void> | undefined;
  let disconnect: (() => void) | undefined;

  const isCurrent = (): boolean => {
    if (stopped) return false;
    if (scope.kind === 'feed') return true;
    const { auth } = api.getState() as TSessionState;
    return auth.version === scope.version && auth.status === 'authenticated';
  };
  const setStatus = (status: TOrderStream['status'], message: string): void => {
    api.updateCachedData((draft) => {
      draft.status = status;
      draft.message = message;
    });
  };
  const clearRetry = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  const stop = (): void => {
    stopped = true;
    clearRetry();
    disconnect?.();
    if (scope.kind === 'user')
      api.updateCachedData((draft) => {
        draft.snapshot = null;
      });
  };

  const connect = (): void => {
    if (!isCurrent()) return;
    clearRetry();
    disconnect?.();
    let accessToken = '';
    if (scope.kind === 'user') {
      try {
        const tokens = readTokens();
        if (!tokens) {
          endSession(api);
          return;
        }
        accessToken = tokens.accessToken;
      } catch {
        api.dispatch(sessionFailed(storageErrorMessage));
        return;
      }
    }
    try {
      const url =
        scope.kind === 'feed'
          ? 'wss://new-stellarburgers.education-services.ru/orders/all'
          : `wss://new-stellarburgers.education-services.ru/orders?token=${encodeURIComponent(accessToken.replace(/^Bearer\s+/i, ''))}`;
      const active = new WebSocket(url);
      socket = active;
      // Поздние события прежнего сокета или пользовательской сессии игнорируются.
      const belongs = (): boolean => isCurrent() && socket === active;
      const lost = (): void => {
        if (!belongs()) return;
        disconnect?.();
        // Последний снимок сохраняется; задержка повторов растёт от 1 до 30 секунд.
        setStatus('reconnecting', 'Связь потеряна. Данные не обновляются.');
        timer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
      const message = (event: MessageEvent): void => {
        if (!belongs()) return;
        let data: unknown;
        try {
          data = JSON.parse(String(event.data)) as unknown;
        } catch {
          setStatus('error', 'Не удалось обновить заказы: некорректные данные.');
          return;
        }

        if (
          scope.kind === 'user' &&
          isObject(data) &&
          data.message === 'Invalid or missing token'
        ) {
          disconnect?.();
          // До корректного снимка разрешён один цикл восстановления через общий с HTTP refresh.
          if (authRetried) {
            endSession(api);
            return;
          }
          authRetried = true;
          setStatus('reconnecting', 'Обновляем авторизацию…');
          recovery = (async (): Promise<void> => {
            try {
              const error = await refreshSession(accessToken, scope.version, api);
              if (!isCurrent()) return;
              if (error)
                setStatus(
                  'error',
                  'Не удалось обновить авторизацию. Повторите попытку.'
                );
              else connect();
            } catch {
              if (isCurrent()) api.dispatch(sessionFailed(storageErrorMessage));
            } finally {
              recovery = undefined;
            }
          })();
          return;
        }

        const snapshot = parseOrderSnapshot(data);
        if (!snapshot) {
          setStatus('error', 'Не удалось обновить заказы: некорректные данные.');
          return;
        }
        // Сообщение — полный снимок: заменяем его целиком и сбрасываем задержку/цикл авторизации.
        retryDelay = 1000;
        authRetried = false;
        api.updateCachedData((draft) => {
          draft.snapshot = snapshot;
          draft.status = 'connected';
          draft.message = '';
        });
      };
      active.addEventListener('message', message);
      active.addEventListener('error', lost);
      active.addEventListener('close', lost);
      disconnect = (): void => {
        socket = undefined;
        active.removeEventListener('message', message);
        active.removeEventListener('error', lost);
        active.removeEventListener('close', lost);
        active.close();
        disconnect = undefined;
      };
    } catch {
      setStatus('reconnecting', 'Не удалось подключиться. Повторяем попытку.');
      timer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }
  };

  const unsubscribeRetry = dispatch(
    addListener({
      predicate: (action): boolean =>
        retryOrderStream.match(action) &&
        action.payload.kind === scope.kind &&
        (action.payload.kind === 'feed' ||
          (scope.kind === 'user' && action.payload.version === scope.version)),
      effect: (): void => {
        // Повтор во время общего refresh не должен открыть сокет с отвергнутым токеном.
        if (!isCurrent() || recovery) return;
        authRetried = false;
        setStatus('connecting', 'Подключаемся…');
        connect();
      },
    })
  );
  const unsubscribeSession = dispatch(
    addListener({
      predicate: (): boolean => !stopped && !isCurrent(),
      effect: stop,
    })
  );

  // Удаление кеша закрывает сокет и отменяет таймер даже до завершения первого queryFn.
  void api.cacheEntryRemoved.then(stop);
  try {
    await api.cacheDataLoaded;
    connect();
  } catch {
    stop();
  }
  await api.cacheEntryRemoved;
  unsubscribeRetry();
  unsubscribeSession();
};
