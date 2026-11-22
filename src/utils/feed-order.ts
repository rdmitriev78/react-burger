import { feedIngredients } from '@utils/feed-data';

import type { TFeedOrder } from '@app-types/feed-order';
import type { TIngredient } from '@app-types/ingredient';

type TFeedOrderItem = { ingredient: TIngredient; quantity: number };

export const getFeedOrderSummary = (
  order: TFeedOrder
): { items: TFeedOrderItem[]; total: number } => {
  const grouped = new Map<string, TFeedOrderItem>();
  let total = 0;

  // Все id принадлежат локальному каталогу; порядок — первое появление в составе.
  for (const id of order.ingredients) {
    const ingredient = feedIngredients[id];
    const existing = grouped.get(id);
    if (existing) existing.quantity += 1;
    else grouped.set(id, { ingredient, quantity: 1 });
    total += ingredient.price;
  }

  return { items: [...grouped.values()], total };
};

export const formatFeedOrderNumber = (number: number): string =>
  number.toString().padStart(6, '0');
