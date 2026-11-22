import {
  CurrencyIcon,
  FormattedDate,
} from '@krgaa/react-developer-burger-ui-components';
import { Link } from 'react-router-dom';

import { IngredientPreview } from '@components/ingredient-preview/ingredient-preview';
import { OrderStatus } from '@components/order-status/order-status';
import { formatOrderNumber, getOrderSummary } from '@utils/order';

import type { TOrder } from '@app-types/order';

import styles from './order-card.module.css';

type TOrderCardProps = {
  order: TOrder;
  basePath: '/feed' | '/profile/orders';
  showStatus: boolean;
};

export const OrderCard = ({
  order,
  basePath,
  showStatus,
}: TOrderCardProps): React.JSX.Element => {
  const { items, total } = getOrderSummary(order);
  const number = formatOrderNumber(order.number);
  return (
    <Link
      className={`${styles.card} p-6`}
      to={`${basePath}/${order.id}`}
      state={basePath === '/feed' ? { fromFeed: true } : { fromProfileOrders: true }}
      aria-label={`Заказ #${number}: ${order.name}`}
    >
      <div className={styles.meta}>
        <span className="text text_type_digits-default">#{number}</span>
        <FormattedDate
          date={new Date(order.createdAt)}
          className="text text_type_main-default text_color_inactive"
        />
      </div>
      <div>
        <h2 className="text text_type_main-medium">{order.name}</h2>
        {showStatus && <OrderStatus status={order.status} />}
      </div>
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
