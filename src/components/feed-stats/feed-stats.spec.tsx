import { makeOrders } from '@/test/fixtures/orders/orders';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { parseOrder } from '@services/orders/order-data';

import { FeedStats } from './feed-stats';

afterEach(cleanup);
describe('статистика ленты', () => {
  it.each([
    [0, 0],
    [10, 1],
    [11, 2],
    [20, 2],
    [21, 2],
  ])('делит %i заказов на %i колонок', (length, columns) => {
    const orders = makeOrders(length, 'done').map((raw) => parseOrder(raw)!);
    render(<FeedStats orders={orders} total={1000} totalToday={100} />);
    const done = screen.getByRole('region', { name: 'Готовы:' });
    expect(within(done).queryAllByRole('list')).toHaveLength(columns);
    expect(within(done).queryAllByRole('listitem')).toHaveLength(Math.min(length, 20));
    for (const column of within(done).queryAllByRole('list'))
      expect(within(column).getAllByRole('listitem').length).toBeLessThanOrEqual(10);
    expect(screen.getByText('1 000')).toBeInTheDocument();
  });
  it('исключает created, разделяет pending/done и обновляет серверные счётчики', () => {
    const pending = makeOrders(1, 'pending').map((raw) => parseOrder(raw)!);
    const { rerender } = render(
      <FeedStats
        orders={[...pending, ...makeOrders(1, 'created').map((raw) => parseOrder(raw)!)]}
        total={7}
        totalToday={2}
      />
    );
    expect(
      within(screen.getByRole('region', { name: 'В работе:' })).getAllByRole('listitem')
    ).toHaveLength(1);
    rerender(
      <FeedStats
        orders={pending.map((order) => ({ ...order, status: 'done' }))}
        total={8}
        totalToday={3}
      />
    );
    expect(
      within(screen.getByRole('region', { name: 'В работе:' })).queryAllByRole(
        'listitem'
      )
    ).toHaveLength(0);
    expect(
      within(screen.getByRole('region', { name: 'Готовы:' })).getAllByRole('listitem')
    ).toHaveLength(1);
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
