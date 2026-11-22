import type { TOrder } from '@app-types/order';

import styles from './order-status.module.css';

const statuses = { created: 'Создан', pending: 'Готовится', done: 'Выполнен' };

export const OrderStatus = ({
  status,
}: {
  status: TOrder['status'];
}): React.JSX.Element => (
  <p
    className={`text text_type_main-default mt-2 ${status === 'done' ? styles.done : ''}`}
  >
    {statuses[status]}
  </p>
);
