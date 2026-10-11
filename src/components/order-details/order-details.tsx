import checkBg from '@images/check-bg.png';

import type { TOrder } from '@utils/types';

import styles from './order-details.module.css';

type TOrderDetailsProps = {
  order: TOrder;
};

export const OrderDetails = ({ order }: TOrderDetailsProps): React.JSX.Element => (
  <div className={styles.details}>
    <p className="text text_type_digits-large mb-8">{order.orderNumber}</p>
    <p className="text text_type_main-medium mb-15">Идентификатор заказа</p>
    <img src={checkBg} alt="Заказ оформлен" className={styles.check_mark} />
    <p className="text text_type_main-default mb-2">Демонстрационный заказ</p>
    <p className="text text_type_main-default text_color_inactive">
      Отправка заказа на сервер пока не подключена
    </p>
  </div>
);
