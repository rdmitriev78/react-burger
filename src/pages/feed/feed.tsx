import { Outlet } from 'react-router-dom';

import { FeedStats } from '@components/feed-stats/feed-stats';
import { OrderCard } from '@components/order-card/order-card';
import { feedOrders } from '@utils/feed-data';

import styles from './feed.module.css';

export const FeedPage = (): React.JSX.Element => (
  <>
    <main className={styles.main}>
      <h1 className="text text_type_main-large mb-5">Лента заказов</h1>
      <div className={styles.content}>
        <ul className={`${styles.orders} custom-scroll`} aria-label="Заказы">
          {feedOrders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} basePath="/feed" showStatus={false} />
            </li>
          ))}
        </ul>
        <FeedStats />
      </div>
    </main>
    <Outlet />
  </>
);
