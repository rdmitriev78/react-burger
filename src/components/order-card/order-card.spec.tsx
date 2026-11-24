import { testIngredients } from '@/test/fixtures/ingredients/ingredients';
import { createdOrder, longOrder, repeatedOrder } from '@/test/fixtures/orders/orders';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { OrderCard } from '@components/order-card/order-card';
import {
  createOrderCatalog,
  parseOrder,
  prepareOrder,
} from '@services/orders/order-data';

const view = (raw: unknown): ReturnType<typeof prepareOrder> =>
  prepareOrder(parseOrder(raw)!, createOrderCatalog(testIngredients));

afterEach(cleanup);
describe('карточка заказа', () => {
  it.each([
    [createdOrder, 'Создан', '480'],
    [longOrder, 'Готовится', '560'],
    [repeatedOrder, 'Выполнен', '250'],
  ] as const)('показывает статус, цену и ссылку истории %o', (raw, status, total) => {
    render(
      <MemoryRouter>
        <OrderCard order={view(raw)!} basePath="/profile/orders" showStatus={true} />
      </MemoryRouter>
    );
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(screen.getByText(total)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/profile/orders/${raw._id}`
    );
  });
  it('показывает короткий состав и скрывает статус публичной карточки', () => {
    render(
      <MemoryRouter>
        <OrderCard order={view(createdOrder)!} basePath="/feed" showStatus={false} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    expect(screen.getByText('480')).toBeInTheDocument();
    expect(screen.queryByText('Создан')).not.toBeInTheDocument();
  });
  it('учитывает затемнённый шестой ингредиент в +N', () => {
    render(
      <MemoryRouter>
        <OrderCard order={view(longOrder)!} basePath="/feed" showStatus={false} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('img')).toHaveLength(6);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('560')).toBeInTheDocument();
  });
});
