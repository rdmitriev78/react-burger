import type { TIngredient } from '@app-types/ingredient';

// Источник определяет способ управления окном, а не адрес страницы, на которой его открыли.
export type TModalSource = 'route' | 'application';

export type TModalState =
  | { type: 'closed' }
  | { type: 'ingredient'; source: 'route'; ingredient: TIngredient }
  | { type: 'order'; source: 'application' }
  | {
      type: 'error';
      source: TModalSource;
      title: string;
      message: string;
      buttonText: string;
    };

export type TErrorModalState = Extract<TModalState, { type: 'error' }>;

export type TOpenModalType = Exclude<TModalState['type'], 'closed'>;
