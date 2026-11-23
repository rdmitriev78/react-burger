import { useMemo } from 'react';
import { Outlet } from 'react-router-dom';

import { OrderCard } from '@components/order-card/order-card';
import { OrderStreamState } from '@components/order-stream-state/order-stream-state';
import { useAppSelector } from '@hooks/redux';
import { useOrderStream } from '@hooks/use-order-stream';
import { selectSessionVersion } from '@services/auth/auth-slice';

import styles from './profile-order.module.css';

export const ProfileOrderPage = (): React.JSX.Element => {
  const version = useAppSelector(selectSessionVersion);
  const scope = useMemo(() => ({ kind: 'user', version }) as const, [version]);
  const context = useOrderStream(scope);
  return (
    <section className={styles.section} aria-label="История заказов">
      <OrderStreamState context={context}>
        <ul
          className={`${styles.orders} custom-scroll`}
          aria-label="Заказы пользователя"
        >
          {context.orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} basePath="/profile/orders" showStatus={true} />
            </li>
          ))}
          {context.orders.length === 0 && (
            <li className="text text_type_main-default">У вас пока нет заказов</li>
          )}
        </ul>
      </OrderStreamState>
      <Outlet context={context} />
    </section>
  );
};
