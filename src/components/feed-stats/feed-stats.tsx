import { formatOrderNumber } from '@utils/order';

import type { TOrder } from '@app-types/order';

import styles from './feed-stats.module.css';

type TFeedStatsProps = { orders: readonly TOrder[]; total: number; totalToday: number };

export const FeedStats = ({
  orders,
  total,
  totalToday,
}: TFeedStatsProps): React.JSX.Element => (
  <section className={styles.stats} aria-label="Статистика заказов">
    <div className={styles.statuses}>
      {(
        [
          ['done', 'Готовы:'],
          ['pending', 'В работе:'],
        ] as const
      ).map(([status, label]) => {
        const selected = orders.filter((order) => order.status === status).slice(0, 20);
        return (
          <section key={status} aria-label={label}>
            <h2 className="text text_type_main-medium mb-6">{label}</h2>
            <div className={styles.columns}>
              {[selected.slice(0, 10), selected.slice(10)]
                .filter((column) => column.length > 0)
                .map((column, index) => (
                  <ul
                    key={index}
                    aria-label={`${label} колонка ${index + 1}`}
                    className={`${styles.numbers} ${status === 'done' ? styles.done : ''}`}
                  >
                    {column.map((order) => (
                      <li key={order.id} className="text text_type_digits-default">
                        {formatOrderNumber(order.number)}
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </section>
        );
      })}
    </div>
    <section>
      <h2 className="text text_type_main-medium">Выполнено за все время:</h2>
      <p className={`${styles.total} text text_type_digits-large`}>
        {total.toLocaleString('ru-RU')}
      </p>
    </section>
    <section>
      <h2 className="text text_type_main-medium">Выполнено за сегодня:</h2>
      <p className={`${styles.total} text text_type_digits-large`}>{totalToday}</p>
    </section>
  </section>
);
