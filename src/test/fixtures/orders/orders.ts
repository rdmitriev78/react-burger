import { testIngredients } from '../ingredients/ingredients';

import type { TOrder } from '@app-types/order';

const [bun, fillet, meteor, rings, sauce, meat, spicy, cheese] = testIngredients.map(
  (item) => item._id
);

export const createdOrder = {
  _id: '100000000000000000000001',
  number: 34535,
  name: 'Death Star Starship Main бургер',
  status: 'created',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ingredients: [bun, fillet, meteor, rings, sauce, bun],
} as const satisfies { ingredients: readonly string[] } & Record<string, unknown>;

export const longOrder = {
  ...createdOrder,
  _id: '100000000000000000000002',
  number: 34534,
  name: 'Interstellar бургер с длинным названием для межзвёздного путешествия',
  status: 'pending',
  ingredients: [bun, fillet, meteor, rings, sauce, meat, spicy, cheese, bun],
} as const;

export const repeatedOrder = {
  ...createdOrder,
  _id: '100000000000000000000003',
  number: 34530,
  name: 'Космический двойной бургер',
  status: 'done',
  ingredients: [bun, meteor, meteor, sauce, bun],
} as const;

export const makeOrders = (
  length: number,
  status: TOrder['status']
): Record<string, unknown>[] =>
  Array.from({ length }, (_, index) => ({
    ...createdOrder,
    _id: (index + 100).toString(16).padStart(24, '0'),
    number: index + 1,
    status,
  }));
