import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { FeedOrderCard } from '@components/feed-order-card/feed-order-card';
import { feedOrders } from '@utils/feed-data';

afterEach(cleanup);

describe('карточка заказа', () => {
  it('показывает короткий состав и полную стоимость', () => {
    render(
      <MemoryRouter>
        <FeedOrderCard order={feedOrders[0]} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    expect(screen.getByText('480')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/feed/34535');
  });

  it('считает в +N все скрытые ингредиенты, включая затемнённый шестой', () => {
    render(
      <MemoryRouter>
        <FeedOrderCard order={feedOrders[1]} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('img')).toHaveLength(6);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('560')).toBeInTheDocument();
  });
});
