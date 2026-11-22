import { demoOrderIngredients } from '@utils/feed-data';

import type { TIngredient } from '@app-types/ingredient';
import type { TOrder } from '@app-types/order';

type TOrderItem = { ingredient: TIngredient; quantity: number };

export const getOrderSummary = (
  order: TOrder
): { items: TOrderItem[]; total: number } => {
  const grouped = new Map<string, TOrderItem>();
  let total = 0;

  // Все id принадлежат локальному каталогу; порядок — первое появление в составе.
  for (const id of order.ingredients) {
    const ingredient = demoOrderIngredients[id];
    const existing = grouped.get(id);
    if (existing) existing.quantity += 1;
    else grouped.set(id, { ingredient, quantity: 1 });
    total += ingredient.price;
  }

  return { items: [...grouped.values()], total };
};

export const formatOrderNumber = (number: number): string =>
  number.toString().padStart(6, '0');
