import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { OrderCard } from '@components/order-card/order-card';
import { feedOrders } from '@utils/feed-data';
import { profileOrders } from '@utils/profile-orders-data';

afterEach(cleanup);

describe('карточка заказа', () => {
  it.each([
    [0, 'Создан', '480'],
    [1, 'Готовится', '560'],
    [2, 'Выполнен', '510'],
  ] as const)(
    'показывает статус и ссылку истории для заказа %i',
    (index, status, total) => {
      const order = profileOrders[index];
      render(
        <MemoryRouter>
          <OrderCard order={order} basePath="/profile/orders" showStatus={true} />
        </MemoryRouter>
      );
      expect(screen.getByText(status)).toBeInTheDocument();
      expect(screen.getByText(total)).toBeInTheDocument();
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        `/profile/orders/${order.id}`
      );
      expect(feedOrders[1].status).toBe('created');
    }
  );

  it('показывает короткий состав и полную стоимость', () => {
    render(
      <MemoryRouter>
        <OrderCard order={feedOrders[0]} basePath="/feed" showStatus={false} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    expect(screen.getByText('480')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/feed/34535');
    expect(screen.queryByText('Создан')).not.toBeInTheDocument();
  });

  it('считает в +N все скрытые ингредиенты, включая затемнённый шестой', () => {
    render(
      <MemoryRouter>
        <OrderCard order={feedOrders[1]} basePath="/feed" showStatus={false} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('img')).toHaveLength(6);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('560')).toBeInTheDocument();
  });
});
