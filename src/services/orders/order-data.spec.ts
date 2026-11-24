import { testIngredients } from '@/test/fixtures/ingredients/ingredients';
import { publicSnapshot } from '@/test/fixtures/orders/order-streams';
import { createdOrder, longOrder, repeatedOrder } from '@/test/fixtures/orders/orders';
import { describe, expect, it } from 'vitest';

import {
  createOrderCatalog,
  isOrderId,
  normalizeOrderId,
  parseOrder,
  parseOrderResponse,
  parseOrderSnapshot,
  prepareOrder,
} from './order-data';

describe('серверные заказы', () => {
  const id = 'abcdef0123456789abcdef01';

  it.each([id, id.toUpperCase(), 'AbCdEf0123456789aBcDeF01'])(
    'нормализует ID корректных и отклонённых записей %s',
    (serverId) => {
      expect(parseOrder({ ...createdOrder, _id: serverId })?.id).toBe(id);
      expect(
        parseOrderSnapshot({
          ...publicSnapshot,
          orders: [{ ...createdOrder, _id: serverId, status: 'wrong' }],
        })?.invalidOrderIds
      ).toEqual([id]);
    }
  );

  it.each([
    [id.toUpperCase(), id],
    [id, id.toUpperCase()],
    ['AbCdEf0123456789aBcDeF01', 'aBcDeF0123456789AbCdEf01'],
  ])('сопоставляет GET %s с ответом %s', (requestedId, serverId) => {
    expect(
      parseOrderResponse(
        { success: true, order: { ...createdOrder, _id: serverId } },
        requestedId
      )?.id
    ).toBe(id);
    expect(
      parseOrderResponse(
        { success: true, order: { ...createdOrder, _id: id.replace(/1$/, '2') } },
        requestedId
      )
    ).toBeUndefined();
  });

  it.each(['ABC', 'G'.repeat(24), 'A'.repeat(23), 'A'.repeat(25), ` ${id}`])(
    'не делает неправильный ID допустимым: %s',
    (invalidId) => {
      expect(normalizeOrderId(invalidId)).toBe(invalidId);
      expect(isOrderId(normalizeOrderId(invalidId))).toBe(false);
    }
  );

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
