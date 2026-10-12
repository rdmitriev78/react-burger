import { useCallback } from 'react';

import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { closeModal, selectModal } from '@services/modal/modal-slice';

import type { TModalTitleOrAriaLabel } from '@app-types/modal';
import type { TOpenModalType } from '@services/modal/modal-slice.types';

const modalConfig = {
  ingredient: { title: 'Детали ингредиента' },
  order: { ariaLabel: 'Заказ оформлен' },
} satisfies Record<TOpenModalType, TModalTitleOrAriaLabel>;

// Отдельный компонент для отображения модалок
// Помогает исключить открытие нескольких модалок одновременно
export const AppModals = (): React.JSX.Element | null => {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectModal);
  const handleClose = useCallback((): void => {
    dispatch(closeModal());
  }, [dispatch]);

  if (modal.type === 'closed') return null;

  return (
    <Modal {...modalConfig[modal.type]} onClose={handleClose}>
      {modal.type === 'ingredient' ? (
        <IngredientDetails ingredient={modal.ingredient} />
      ) : (
        <OrderDetails order={modal.order} />
      )}
    </Modal>
  );
};
