import {
  CurrencyIcon,
  FormattedDate,
} from '@krgaa/react-developer-burger-ui-components';
import { Link } from 'react-router-dom';

import { IngredientPreview } from '@components/ingredient-preview/ingredient-preview';
import { formatFeedOrderNumber, getFeedOrderSummary } from '@utils/feed-order';

import type { TFeedOrder } from '@app-types/feed-order';

import styles from './feed-order-card.module.css';

export const FeedOrderCard = ({ order }: { order: TFeedOrder }): React.JSX.Element => {
  const { items, total } = getFeedOrderSummary(order);
  const number = formatFeedOrderNumber(order.number);
  return (
    <Link
      className={`${styles.card} p-6`}
      to={`/feed/${order.id}`}
      state={{ fromFeed: true }}
      aria-label={`Заказ #${number}: ${order.name}`}
    >
      <div className={styles.meta}>
        <span className="text text_type_digits-default">#{number}</span>
        <FormattedDate
          date={new Date(order.createdAt)}
          className="text text_type_main-default text_color_inactive"
        />
      </div>
      <h2 className="text text_type_main-medium">{order.name}</h2>
      <div className={styles.footer}>
        <div className={styles.previews}>
          {items.slice(0, 6).map(({ ingredient }, index) => (
            <span key={ingredient._id} style={{ zIndex: 6 - index }}>
              <IngredientPreview
                ingredient={ingredient}
                hiddenCount={
                  index === 5 && items.length > 6 ? items.length - 5 : undefined
                }
              />
            </span>
          ))}
        </div>
        <span className={`${styles.price} text text_type_digits-default`}>
          {total} <CurrencyIcon type="primary" />
        </span>
      </div>
    </Link>
  );
};
