import { testIngredients } from '@/test/fixtures/ingredients/ingredients';
import { createdOrder, longOrder, repeatedOrder } from '@/test/fixtures/orders/orders';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OrderInfo } from '@components/order-info/order-info';
import {
  createOrderCatalog,
  parseOrder,
  prepareOrder,
} from '@services/orders/order-data';

const view = (raw: unknown): ReturnType<typeof prepareOrder> =>
  prepareOrder(parseOrder(raw)!, createOrderCatalog(testIngredients));

afterEach(cleanup);
describe('информация о заказе', () => {
  it('объединяет повторы в строки и показывает полный итог', () => {
    render(<OrderInfo order={view(repeatedOrder)!} />);
    const items = within(
      screen.getByRole('list', { name: 'Состав заказа' })
    ).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('2 x 20');
    expect(items[1]).toHaveTextContent('2 x 90');
    expect(screen.getByText('250')).toBeInTheDocument();
  });
  it.each([
    [createdOrder, 'Создан'],
    [longOrder, 'Готовится'],
    [repeatedOrder, 'Выполнен'],
  ] as const)('показывает выбранный заказ %o', (raw, status) => {
    render(<OrderInfo order={view(raw)!} />);
    expect(screen.getByRole('heading', { name: raw.name })).toBeInTheDocument();
    expect(screen.getByText(status)).toBeInTheDocument();
  });
});
