import { Button } from '@krgaa/react-developer-burger-ui-components';
import { useEffect, useState } from 'react';

import { RequestLoading } from '@components/request-loading/request-loading';
import { useOrderSubmission } from '@hooks/use-order-submission';

import type { TOrderState } from '@services/order/order-slice.types';

import styles from './order-details.module.css';

const stopWaitingDelayMs = 10_000;

// Обход ошибки production-сборки: при обычном импорте изображения конструктор URL
// подменяется константой URL из react-dnd-html5-backend ("Vo is not a constructor").
const checkBg = new URL('../../assets/images/check-bg.png', import.meta.url).href;

const OrderSubmission = (): React.JSX.Element => {
  const { stopWaiting } = useOrderSubmission();

  const [isLongWait, setIsLongWait] = useState(false);

  useEffect(() => {
    // Кнопка прерывания появляется только при долгом ожидании.
    const timer = setTimeout(() => {
      setIsLongWait(true);
    }, stopWaitingDelayMs);

    return (): void => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div role="status">
        <RequestLoading message="Оформление заказа…" />
      </div>
      {isLongWait && (
        <>
          <p role="status" className="text text_type_main-default mt-8 mb-6">
            Оформление занимает больше времени, чем обычно
          </p>
          <Button onClick={stopWaiting} type="secondary" size="medium" htmlType="button">
            Прекратить ожидание
          </Button>
        </>
      )}
    </>
  );
};

type TOrderSuccessProps = {
  orderNumber: number;
  name: string;
};

const OrderSuccess = ({ orderNumber, name }: TOrderSuccessProps): React.JSX.Element => (
  <>
    <p className="text text_type_digits-large mb-8">{orderNumber}</p>
    <p className="text text_type_main-medium mb-4">Идентификатор заказа</p>
    <p className="text text_type_main-medium mb-15">{name}</p>
    <img src={checkBg} alt="Заказ оформлен" className={styles.check_mark} />
    <p className="text text_type_main-default mb-2">Ваш заказ начали готовить</p>
    <p className="text text_type_main-default text_color_inactive">
      Дождитесь готовности на орбитальной станции
    </p>
  </>
);

type TOrderErrorProps = {
  message: string;
};

const OrderError = ({ message }: TOrderErrorProps): React.JSX.Element => (
  <p role="alert" className="text text_type_main-medium">
    {message}
  </p>
);

const OrderStopped = (): React.JSX.Element => (
  <div role="status">
    <p className="text text_type_main-medium mb-6">Ожидание прекращено.</p>
    <p className="text text_type_main-default text_color_inactive">
      Заказ мог быть создан, но подтверждение не получено.
    </p>
  </div>
);

// Новый статус требует отдельного case; неожиданное значение перехватит ErrorBoundary.
const assertNever = (_value: never): never => {
  throw new Error('Неизвестное состояние диалога заказа');
};

type TOrderDetailsProps = {
  order: TOrderState;
};

export const OrderDetails = ({
  order,
}: TOrderDetailsProps): React.JSX.Element | null => {
  let content: React.JSX.Element;

  switch (order.status) {
    case 'idle':
      return null;
    case 'submitting':
      content = <OrderSubmission />;
      break;
    case 'success':
      content = (
        <OrderSuccess
          orderNumber={order.orderResult.orderNumber}
          name={order.orderResult.name}
        />
      );
      break;
    case 'error':
      content = <OrderError message={order.message} />;
      break;
    case 'stopped':
      content = <OrderStopped />;
      break;
    default:
      // на случай появления нового статуса
      return assertNever(order);
  }

  return <div className={styles.details}>{content}</div>;
};
