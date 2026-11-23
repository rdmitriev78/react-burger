import { Outlet } from 'react-router-dom';

import { FeedStats } from '@components/feed-stats/feed-stats';
import { OrderCard } from '@components/order-card/order-card';
import { OrderStreamState } from '@components/order-stream-state/order-stream-state';
import { useOrderStream } from '@hooks/use-order-stream';

import styles from './feed.module.css';

const feedScope = { kind: 'feed' } as const;

export const FeedPage = (): React.JSX.Element => {
  const context = useOrderStream(feedScope);
  return (
    <>
      <main className={styles.main}>
        <h1 className="text text_type_main-large mb-5">Лента заказов</h1>
        <OrderStreamState context={context}>
          <div className={styles.content}>
            <ul className={`${styles.orders} custom-scroll`} aria-label="Заказы">
              {context.orders.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} basePath="/feed" showStatus={false} />
                </li>
              ))}
              {context.orders.length === 0 && (
                <li className="text text_type_main-default">Заказов пока нет</li>
              )}
            </ul>
            {context.stream.snapshot && (
              <FeedStats
                orders={context.orders}
                total={context.stream.snapshot.total}
                totalToday={context.stream.snapshot.totalToday}
              />
            )}
          </div>
        </OrderStreamState>
      </main>
      <Outlet context={context} />
    </>
  );
};
