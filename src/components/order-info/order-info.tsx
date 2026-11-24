import {
  CurrencyIcon,
  FormattedDate,
} from '@krgaa/react-developer-burger-ui-components';

import { IngredientPreview } from '@components/ingredient-preview/ingredient-preview';
import { OrderStatus } from '@components/order-status/order-status';

import type { TOrderView } from '@app-types/order';

import styles from './order-info.module.css';

type TOrderInfoProps = {
  order: TOrderView;
};

export const OrderInfo = ({ order }: TOrderInfoProps): React.JSX.Element => {
  const { items, total } = order.summary;
  return (
    <div className="mt-5">
      <h3 className="text text_type_main-medium">{order.name}</h3>
      <OrderStatus status={order.status} />
      <h3 className="text text_type_main-medium mt-15 mb-6">Состав:</h3>
      <ul
        className={`${styles.ingredients} custom-scroll`}
        aria-label="Состав заказа"
        tabIndex={0}
      >
        {items.map(({ ingredient, quantity }) => (
          <li key={ingredient._id} className={styles.item}>
            <IngredientPreview ingredient={ingredient} />
            <span className={`${styles.name} text text_type_main-default`}>
              {ingredient.name}
            </span>
            <span className={`${styles.price} text text_type_digits-default`}>
              {quantity} x {ingredient.price} <CurrencyIcon type="primary" />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <FormattedDate
          date={new Date(order.createdAt)}
          className="text text_type_main-default text_color_inactive"
        />
        <span className={`${styles.price} text text_type_digits-default`}>
          {total} <CurrencyIcon type="primary" />
        </span>
      </div>
    </div>
  );
};
