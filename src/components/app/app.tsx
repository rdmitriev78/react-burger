import { useCallback, useState } from 'react';

import { AppHeader } from '@components/app-header/app-header';
import { BurgerConstructor } from '@components/burger-constructor/burger-constructor';
import { BurgerIngredients } from '@components/burger-ingredients/burger-ingredients';
import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal, type ModalTitleOrAriaLabel } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { RequestError } from '@components/request-error/request-error';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useIngredients } from '@hooks/use-ingredients';

import type { TIngredient } from '@utils/types';

import styles from './app.module.css';

type TModalState =
  | { type: 'ingredient'; ingredient: TIngredient }
  | { type: 'order'; orderNumber: string }
  | null;

const MODAL_LABELS = {
  ingredient: { title: 'Детали ингредиента' },
  order: { ariaLabel: 'Заказ оформлен' },
} satisfies Record<NonNullable<TModalState>['type'], ModalTitleOrAriaLabel>;

export const App = (): React.JSX.Element => {
  const [modal, setModal] = useState<TModalState>(null);
  const closeModal = useCallback((): void => setModal(null), []);
  const { requestState, retry } = useIngredients();

  return (
    <div className={styles.app}>
      <AppHeader />
      <h1 className={`${styles.title} text text_type_main-large mt-10 mb-5 pl-5`}>
        Соберите бургер
      </h1>
      {requestState.status === 'loading' && (
        <div className="mt-20">
          <RequestLoading message="Загружаем ингредиенты…" />
        </div>
      )}
      {requestState.status === 'error' && (
        <div className="mt-20">
          <RequestError message={requestState.message} onRetry={retry} />
        </div>
      )}
      {requestState.status === 'success' && (
        <main className={`${styles.main} pl-5 pr-5`}>
          <BurgerIngredients
            ingredients={requestState.ingredients}
            onIngredientClick={(ingredient): void =>
              setModal({ type: 'ingredient', ingredient })
            }
          />
          <BurgerConstructor
            ingredients={requestState.ingredients}
            onOrderClick={(): void => setModal({ type: 'order', orderNumber: '034536' })}
          />
        </main>
      )}
      {modal && (
        <Modal {...MODAL_LABELS[modal.type]} onClose={closeModal}>
          {modal.type === 'ingredient' ? (
            <IngredientDetails ingredient={modal.ingredient} />
          ) : (
            <OrderDetails orderNumber={modal.orderNumber} />
          )}
        </Modal>
      )}
    </div>
  );
};

export default App;
