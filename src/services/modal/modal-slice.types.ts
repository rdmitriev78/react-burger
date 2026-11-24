import type { TIngredient } from '@app-types/ingredient';
import type { TOrderScope, TOrderView } from '@app-types/order';

export type TOrderInfoView =
  | { status: 'loading'; message: string }
  | { status: 'ready'; order: TOrderView }
  | {
      status: 'error';
      title: string;
      message: string;
      /**
       * Действие кнопки «Повторить» в окне ошибки:
       * - stream — переподключить WebSocket текущей ленты, если до первого
       *   корректного снимка возникла ошибка потока;
       * - catalog — повторить GET каталога ингредиентов при ошибке его загрузки;
       * - order — повторить GET отдельного заказа, отсутствующего в снимке,
       *   при ошибке запроса (кроме 404) или некорректном ответе;
       * - null — скрыть кнопку повтора: неверный ID, заказ не найден (404)
       *   либо данные заказа или его состав непригодны для отображения.
       */
      retry: 'stream' | 'catalog' | 'order' | null;
    };

export type TOrderInfoModal = { scope: TOrderScope; id: string; view: TOrderInfoView };

// Источник определяет способ управления окном, а не адрес страницы, на которой его открыли.
export type TModalSource = 'route' | 'application';

export type TModalState =
  | { type: 'closed' }
  | { type: 'ingredient'; source: 'route'; ingredient: TIngredient }
  | { type: 'order'; source: 'application' }
  | ({ type: 'order-info'; source: 'route' } & TOrderInfoModal)
  | {
      type: 'error';
      source: TModalSource;
      title: string;
      message: string;
      buttonText: string;
    };

export type TErrorModalState = Extract<TModalState, { type: 'error' }>;

export type TOpenModalType = Exclude<TModalState['type'], 'closed'>;
