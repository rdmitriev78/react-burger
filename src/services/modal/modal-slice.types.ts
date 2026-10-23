import type { TIngredient } from '@app-types/ingredient';

export type TModalState =
  | { type: 'closed' }
  | { type: 'ingredient'; ingredient: TIngredient }
  | { type: 'order' };

export type TOpenModalType = Exclude<TModalState['type'], 'closed'>;
