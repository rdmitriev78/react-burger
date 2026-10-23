import { useCallback } from 'react';

import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { closeModal, selectModal } from '@services/modal/modal-slice';
import { selectOrderSubmission } from '@services/order/order-slice';

import type { TIngredient } from '@app-types/ingredient';
import type { TOrderState } from '@services/order/order-slice.types';

const orderModalLabels = {
  submitting: 'Оформление заказа',
  success: 'Заказ оформлен',
  error: 'Ошибка оформления заказа',
  stopped: 'Ожидание прекращено',
} satisfies Record<Exclude<TOrderState['status'], 'idle'>, string>;

type TIngredientModalProps = {
  ingredient: TIngredient;
  onClose: () => void;
};

const IngredientModal = ({
  ingredient,
  onClose,
}: TIngredientModalProps): React.JSX.Element => (
  <Modal title="Детали ингредиента" onClose={onClose}>
    <IngredientDetails ingredient={ingredient} />
  </Modal>
);

type TOrderModalProps = {
  onClose: () => void;
};

const OrderModal = ({ onClose }: TOrderModalProps): React.JSX.Element | null => {
  const order = useAppSelector(selectOrderSubmission);

  if (order.status === 'idle') return null;

  return (
    <Modal
      ariaLabel={orderModalLabels[order.status]}
      onClose={onClose}
      canClose={order.status !== 'submitting'}
    >
      <OrderDetails order={order} />
    </Modal>
  );
};

// Новый тип модалки требует отдельного case; неожиданное значение перехватит ErrorBoundary.
const assertNever = (_value: never): never => {
  throw new Error('Неизвестный тип модального окна');
};

// Состояние модалки выбирает один диалог; все диалоги закрываются общим обработчиком.
export const AppModals = (): React.JSX.Element | null => {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectModal);
  const handleClose = useCallback((): void => {
    dispatch(closeModal());
  }, [dispatch]);

  switch (modal.type) {
    case 'closed':
      return null;
    case 'ingredient':
      return <IngredientModal ingredient={modal.ingredient} onClose={handleClose} />;
    case 'order':
      return <OrderModal onClose={handleClose} />;
    default:
      // на случай появления нового типа
      return assertNever(modal);
  }
};
