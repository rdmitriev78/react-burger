import { Outlet } from 'react-router-dom';

import { OrderCard } from '@components/order-card/order-card';
import { profileOrders } from '@utils/profile-orders-data';

import styles from './profile-order.module.css';

export const ProfileOrderPage = (): React.JSX.Element => (
  <section className={styles.section} aria-label="История заказов">
    <ul className={`${styles.orders} custom-scroll`} aria-label="Заказы пользователя">
      {profileOrders.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} basePath="/profile/orders" showStatus={true} />
        </li>
      ))}
    </ul>
    <Outlet />
  </section>
);
