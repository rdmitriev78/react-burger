import { describe, expect, it } from 'vitest';

import { feedIngredients, feedOrders } from '@utils/feed-data';
import { getFeedOrderSummary } from '@utils/feed-order';

describe('состав заказа ленты', () => {
  it('учитывает двойную булку и повторную начинку, сохраняя порядок', () => {
    const summary = getFeedOrderSummary(feedOrders[4]);
    expect(
      summary.items.map(({ ingredient, quantity }) => [ingredient.type, quantity])
    ).toEqual([
      ['bun', 2],
      ['main', 2],
      ['sauce', 1],
    ]);
    expect(summary.items.map(({ ingredient }) => ingredient._id)).toEqual([
      ...new Set(feedOrders[4].ingredients),
    ]);
    expect(summary.total).toBe(250);
  });

  it('использует один состав для полной суммы и сгруппированных строк', () => {
    for (const order of feedOrders) {
      const { items, total } = getFeedOrderSummary(order);
      expect(total).toBe(
        order.ingredients.reduce((sum, id) => sum + feedIngredients[id].price, 0)
      );
      expect(total).toBe(
        items.reduce(
          (sum, { ingredient, quantity }) => sum + ingredient.price * quantity,
          0
        )
      );
    }
    expect(
      feedOrders.slice(0, 4).map((order) => getFeedOrderSummary(order).total)
    ).toEqual([480, 560, 510, 370]);
  });
});
