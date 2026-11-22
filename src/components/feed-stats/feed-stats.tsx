import { feedOrders, feedTotals } from '@utils/feed-data';
import { formatOrderNumber } from '@utils/order';

import styles from './feed-stats.module.css';

export const FeedStats = (): React.JSX.Element => (
  <section className={styles.stats} aria-label="Статистика заказов">
    <div className={styles.statuses}>
      {(
        [
          ['done', 'Готовы:'],
          ['pending', 'В работе:'],
        ] as const
      ).map(([status, label]) => (
        <section key={status}>
          <h2 className="text text_type_main-medium mb-6">{label}</h2>
          <ul className={`${styles.numbers} ${status === 'done' ? styles.done : ''}`}>
            {feedOrders
              .filter((order) => order.status === status)
              .map((order) => (
                <li key={order.id} className="text text_type_digits-default">
                  {formatOrderNumber(order.number)}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
    <section>
      <h2 className="text text_type_main-medium">Выполнено за все время:</h2>
      <p className={`${styles.total} text text_type_digits-large`}>
        {feedTotals.total.toLocaleString('ru-RU')}
      </p>
    </section>
    <section>
      <h2 className="text text_type_main-medium">Выполнено за сегодня:</h2>
      <p className={`${styles.total} text text_type_digits-large`}>{feedTotals.today}</p>
    </section>
  </section>
);
