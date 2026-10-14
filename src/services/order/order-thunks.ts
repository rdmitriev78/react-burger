import { burgerApi } from '@services/api/burger-api';
import { openOrderModal } from '@services/modal/modal-slice';
import {
  orderSubmissionFailed,
  orderSubmissionStopped,
  orderSubmissionSucceeded,
  selectIsOrderSubmitting,
  startOrderSubmission,
} from '@services/order/order-slice';

import type { AppThunk } from '@services/store';

// Все отправки используют одну запись в кеше RTK Query. По этому же ключу
// stopWaiting найдёт запрос, даже если его вызвал другой компонент.
const orderSubmissionCacheKey = 'order-submission';
const orderRequestTimeoutMs = 60_000;

// Селектор читает данные и requestId последней отправки по общему ключу.
const selectOrderRequest = burgerApi.endpoints.createOrder.select(
  orderSubmissionCacheKey
);

/**
 * Создаёт thunk отправки заказа. Он выполняется через dispatch(submitOrder(ids)),
 * получает dispatch и getState от Redux и возвращает Promise<void>.
 * Состав конструктора сохраняется; состояние оформления обновляется отдельно от модалки.
 */
export const submitOrder =
  (ingredientIds: string[]): AppThunk<Promise<void>> =>
  async (dispatch, getState): Promise<void> => {
    // Состояние меняется синхронно, поэтому быстрое двойное нажатие не создаст второй запрос.
    if (selectIsOrderSubmitting(getState())) return;

    // Начало оформления сбрасывает старый результат и блокирует повторную отправку.
    dispatch(startOrderSubmission());

    // Открываем диалог до начала запроса: фон блокируется.
    dispatch(openOrderModal());

    // initiate запускает существующий endpoint без React-хука useMutation.
    // request содержит unwrap и abort и остаётся локальной переменной thunk;
    // в Redux state RTK Query записывает только данные и состояние запроса.
    const request = dispatch(
      burgerApi.endpoints.createOrder.initiate(
        { ingredients: ingredientIds },
        { fixedCacheKey: orderSubmissionCacheKey }
      )
    );

    // После await читаем актуальное состояние через getState.
    // Статус исключает обновление после stopWaiting, а requestId отличает эту
    // отправку от следующей, которая использует тот же ключ кеша.
    const isCurrentRequest = (): boolean => {
      const state = getState();
      return (
        selectIsOrderSubmitting(state) &&
        selectOrderRequest(state).requestId === request.requestId
      );
    };

    // RTK Query 2.9.0: при включённом встроенном timeout fetchBaseQuery передаёт
    // abortController.abort в обработчик без привязки this. Ручной request.abort()
    // вызывает Illegal invocation и не прерывает внутренний fetch.
    // https://github.com/reduxjs/redux-toolkit/blob/v2.9.0/packages/toolkit/src/query/fetchBaseQuery.ts#L229-L235
    // Используем свой таймер; тайм-аут попадёт в catch как ошибка.
    // После обновления RTK Query убрать обход, если встроенный timeout и ручное
    // прекращение ожидания корректно прерывают зависший запрос.
    const timeout = setTimeout(() => {
      request.abort();
    }, orderRequestTimeoutMs);

    try {
      // unwrap возвращает тело успешного ответа или отклоняет Promise при ошибке.
      // Корректность номера и названия проверяет сам endpoint createOrder.
      const response = await request.unwrap();
      if (!isCurrentRequest()) return;

      dispatch(
        orderSubmissionSucceeded({
          orderNumber: response.order.number,
          name: response.name,
        })
      );
    } catch {
      // Ручное прерывание уже показало stopped; ошибкой его не заменяем.
      // Ошибку предыдущей отправки также не переносим в состояние нового заказа.
      if (!isCurrentRequest()) return;

      // Ошибки сети, HTTP, структуры ответа и тайм-аут имеют общее сообщение.
      dispatch(orderSubmissionFailed('Ошибка при отправке заказа, повторите позже'));
    } finally {
      // Освобождаем таймер при любом исходе, включая возврат из try или catch.
      clearTimeout(timeout);
    }
  };

/**
 * Прекращает ожидание запроса. Используется кнопкой в диалоге
 * и при размонтировании App; отмену создания заказа на сервере не гарантирует.
 */
export const stopWaiting =
  (): AppThunk =>
  (dispatch, getState): void => {
    if (!selectIsOrderSubmitting(getState())) return;

    // util возвращает объект уже запущенной мутации и не создаёт новый запрос.
    // RTK Query хранит этот объект вне Redux state. Если запрос уже завершён,
    // утилита может вернуть undefined — процесс всё равно перейдёт в stopped.
    const request = dispatch(
      burgerApi.util.getRunningMutationThunk('createOrder', orderSubmissionCacheKey)
    );

    // Сначала меняем статус, чтобы результат abort не заменил его на error.
    dispatch(orderSubmissionStopped());
    // Прерываем ожидание в браузере; заказ на сервере мог уже быть создан.
    request?.abort();
  };
