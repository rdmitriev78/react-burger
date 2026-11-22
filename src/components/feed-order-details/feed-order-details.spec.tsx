import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FeedOrderDetails } from '@components/feed-order-details/feed-order-details';
import { feedOrders } from '@utils/feed-data';

afterEach(cleanup);

describe('детали заказа ленты', () => {
  it('объединяет повторы в строки и показывает общий итог', () => {
    render(<FeedOrderDetails order={feedOrders[4]} />);
    const items = within(
      screen.getByRole('list', { name: 'Состав заказа' })
    ).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('2 x 20');
    expect(items[1]).toHaveTextContent('2 x 90');
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it.each([
    [0, 'Создан'],
    [2, 'Выполнен'],
    [7, 'Готовится'],
  ] as const)('показывает данные и статус выбранного заказа %i', (index, status) => {
    render(<FeedOrderDetails order={feedOrders[index]} />);
    expect(
      screen.getByRole('heading', { name: feedOrders[index].name })
    ).toBeInTheDocument();
    expect(screen.getByText(status)).toBeInTheDocument();
  });
});
