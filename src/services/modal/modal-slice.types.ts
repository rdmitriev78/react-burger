import type { TIngredient } from '@app-types/ingredient';
import type { TOrder } from '@app-types/order';

export type TModalState =
  | { type: 'closed' }
  | { type: 'ingredient'; ingredient: TIngredient }
  | { type: 'order'; order: TOrder };

export type TOpenModalType = Exclude<TModalState['type'], 'closed'>;
