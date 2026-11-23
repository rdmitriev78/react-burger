import { testIngredients } from '@/test/fixtures/ingredients/ingredients';
import { publicSnapshot } from '@/test/fixtures/orders/order-streams';
import { createdOrder, longOrder, repeatedOrder } from '@/test/fixtures/orders/orders';
import { describe, expect, it } from 'vitest';

import {
  createOrderCatalog,
  parseOrder,
  parseOrderResponse,
  parseOrderSnapshot,
  prepareOrder,
} from './order-data';

describe('серверные заказы', () => {
  it('отбрасывает повреждённые элементы отдельно, сохраняя счётчики и порядок', () => {
    const result = parseOrderSnapshot({
      ...publicSnapshot,
      orders: [longOrder, { ...createdOrder, status: 'unknown' }, repeatedOrder],
    });
    expect(result?.orders.map((order) => order.id)).toEqual([
      longOrder._id,
      repeatedOrder._id,
    ]);
    expect(result?.invalidOrderIds).toEqual([createdOrder._id]);
    expect(result?.total).toBe(28752);
    expect(parseOrderSnapshot({ ...publicSnapshot, total: -1 })).toBeUndefined();
  });

  it.each([
    { number: -1 },
    { number: 1.2 },
    { createdAt: 'bad' },
    { ingredients: [] },
    { ingredients: [null] },
    { _id: '' },
    { name: 3 },
  ])('отклоняет неправильный заказ %o', (patch) => {
    expect(parseOrder({ ...createdOrder, ...patch })).toBeUndefined();
  });

  it.each([undefined, null, '   '])(
    'поддерживает отсутствующее название %s и номер 0',
    (name) => {
      expect(parseOrder({ ...createdOrder, name, number: 0 })).toMatchObject({
        name: 'Бургер',
        number: 0,
      });
    }
  );

  it('проверяет оболочку и идентификатор ответа GET', () => {
    expect(
      parseOrderResponse({ success: true, order: createdOrder }, createdOrder._id)?.id
    ).toBe(createdOrder._id);
    expect(
      parseOrderResponse({ success: true, order: createdOrder }, longOrder._id)
    ).toBeUndefined();
    expect(
      parseOrderResponse({ success: false, order: createdOrder }, createdOrder._id)
    ).toBeUndefined();
  });

  it('использует серверный каталог и не возвращает частичный состав', () => {
    const order = parseOrder(repeatedOrder)!;
    const catalog = createOrderCatalog(testIngredients);
    expect(prepareOrder(order, catalog)?.summary).toMatchObject({
      total: 250,
      items: [{ quantity: 2 }, { quantity: 2 }, { quantity: 1 }],
    });
    expect(
      prepareOrder({ ...order, ingredients: [...order.ingredients, 'missing'] }, catalog)
    ).toBeUndefined();
    const invalidCatalog = createOrderCatalog(
      testIngredients.map((item) => ({ ...item, price: NaN }))
    );
    expect(prepareOrder(order, invalidCatalog)).toBeUndefined();
    expect(
      prepareOrder(
        order,
        createOrderCatalog(
          testIngredients.map((item) => ({ ...item, image_mobile: '' }))
        )
      )
    ).toBeUndefined();
  });
});
