import { testIngredients } from '@/test/fixtures/ingredients/ingredients';
import { createdOrder, longOrder, repeatedOrder } from '@/test/fixtures/orders/orders';
import { describe, expect, it } from 'vitest';

import { createOrderCatalog, parseOrder } from '@services/orders/order-data';
import { getOrderSummary } from '@utils/order';

const catalog = createOrderCatalog(testIngredients);

describe('состав заказа', () => {
  it('учитывает двойную булку и повторную начинку, сохраняя порядок', () => {
    const order = parseOrder(repeatedOrder)!;
    const summary = getOrderSummary(order, catalog)!;
    expect(
      summary.items.map(({ ingredient, quantity }) => [ingredient.type, quantity])
    ).toEqual([
      ['bun', 2],
      ['main', 2],
      ['sauce', 1],
    ]);
    expect(summary.items.map(({ ingredient }) => ingredient._id)).toEqual([
      ...new Set(order.ingredients),
    ]);
    expect(summary.total).toBe(250);
  });

  it.each([
    [createdOrder, 480],
    [longOrder, 560],
    [repeatedOrder, 250],
  ] as const)('согласует общий итог и сгруппированные строки %o', (raw, expected) => {
    const { items, total } = getOrderSummary(parseOrder(raw)!, catalog)!;
    expect(total).toBe(expected);
    expect(
      items.reduce(
        (sum, { ingredient, quantity }) => sum + ingredient.price * quantity,
        0
      )
    ).toBe(expected);
  });

  it('не считает частичную сумму для неизвестного ингредиента', () => {
    expect(
      getOrderSummary(
        { ...parseOrder(createdOrder)!, ingredients: ['constructor'] },
        catalog
      )
    ).toBeUndefined();
  });
});
