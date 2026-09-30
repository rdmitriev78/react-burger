import { Preloader } from '@krgaa/react-developer-burger-ui-components';
import { useCallback, useEffect, useState } from 'react';

import { AppHeader } from '@components/app-header/app-header';
import { BurgerConstructor } from '@components/burger-constructor/burger-constructor';
import { BurgerIngredients } from '@components/burger-ingredients/burger-ingredients';
import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal, type ModalTitleOrAriaLabel } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { DEFAULT_INGREDIENT_ERROR, getIngredients } from '@utils/ingredient-api';

import type { TIngredient } from '@utils/types';

import styles from './app.module.css';

type TRequestState =
  | { status: 'loading' }
  | { status: 'success'; ingredients: TIngredient[] }
  | { status: 'error'; message: string };

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
  const [requestState, setRequestState] = useState<TRequestState>({
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();

    const loadIngredients = async (): Promise<void> => {
      try {
        const ingredients = await getIngredients(controller.signal);
        setRequestState({ status: 'success', ingredients });
      } catch (error: unknown) {
        // если запрос отменён
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setRequestState({
          status: 'error',
          message: error instanceof Error ? error.message : DEFAULT_INGREDIENT_ERROR,
        });
      }
    };

    void loadIngredients();

    return (): void => {
      controller.abort();
    };
  }, []);

  return (
    <div className={styles.app}>
      <AppHeader />
      <h1 className={`${styles.title} text text_type_main-large mt-10 mb-5 pl-5`}>
        Соберите бургер
      </h1>
      {requestState.status === 'loading' && <Preloader />}
      {requestState.status === 'error' && <p>{requestState.message}</p>}
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
