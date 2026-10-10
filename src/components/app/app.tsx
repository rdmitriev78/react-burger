import { useCallback, useState } from 'react';

import { AppHeader } from '@components/app-header/app-header';
import { BurgerConstructor } from '@components/burger-constructor/burger-constructor';
import { BurgerIngredients } from '@components/burger-ingredients/burger-ingredients';
import { ErrorView } from '@components/error-view/error-view';
import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal, type ModalTitleOrAriaLabel } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useIngredientCounts } from '@hooks/use-ingredient-counts';
import { useIngredients } from '@hooks/use-ingredients';
import { mockConstructorState } from '@utils/mock-constructor';

import type { TConstructorState, TIngredient, TOrder } from '@utils/types';

import styles from './app.module.css';

type TModalState =
  | { type: 'ingredient'; ingredient: TIngredient }
  | { type: 'order'; order: TOrder }
  | null;

const modalLabels = {
  ingredient: { title: 'Детали ингредиента' },
  order: { ariaLabel: 'Заказ оформлен' },
} satisfies Record<NonNullable<TModalState>['type'], ModalTitleOrAriaLabel>;

export const App = (): React.JSX.Element => {
  const [constructorState, setConstructorState] = useState<TConstructorState | null>(
    mockConstructorState
  );
  const ingredientCounts = useIngredientCounts(constructorState);
  const [modal, setModal] = useState<TModalState>(null);
  const closeModal = useCallback((): void => setModal(null), []);
  const openIngredientModal = useCallback(
    (ingredient: TIngredient): void => setModal({ type: 'ingredient', ingredient }),
    []
  );
  const openOrderModal = useCallback((): void => {
    if (!constructorState) return;

    setModal({ type: 'order', order: { orderNumber: '034536' } });
  }, [constructorState]);

  const { requestState, retry } = useIngredients();

  const ingredientRemove = useCallback((id: string): void => {
    setConstructorState((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        ingredients: prev.ingredients.filter((ingredient) => ingredient.id !== id),
      };
    });
  }, []);

  return (
    <div className={styles.app}>
      <AppHeader />
      {requestState.status !== 'error' && (
        <h1 className={`${styles.title} text text_type_main-large mt-10 mb-5 pl-5`}>
          Соберите бургер
        </h1>
      )}
      {requestState.status === 'loading' && (
        <div className="mt-20">
          <RequestLoading message="Загружаем ингредиенты…" />
        </div>
      )}
      {requestState.status === 'error' && (
        <main className={styles.error}>
          <ErrorView
            title="Не удалось загрузить ингредиенты"
            message={requestState.message}
            buttonText="Повторить загрузку"
            onButtonClick={retry}
          />
        </main>
      )}
      {requestState.status === 'success' && (
        <main className={`${styles.main} pl-5 pr-5`}>
          <BurgerIngredients
            ingredients={requestState.ingredients}
            ingredientCounts={ingredientCounts}
            onIngredientClick={openIngredientModal}
          />
          <BurgerConstructor
            constructorState={constructorState}
            onOrderClick={openOrderModal}
            onIngredientRemove={ingredientRemove}
          />
        </main>
      )}
      {modal && (
        <Modal {...modalLabels[modal.type]} onClose={closeModal}>
          {modal.type === 'ingredient' ? (
            <IngredientDetails ingredient={modal.ingredient} />
          ) : (
            <OrderDetails order={modal.order} />
          )}
        </Modal>
      )}
    </div>
  );
};

export default App;
