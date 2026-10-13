import {
  Button,
  ConstructorElement,
  CurrencyIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { memo, useCallback, useId, useState } from 'react';

import { BurgerConstructorDropZone } from '@components/burger-constructor-drop-zone/burger-constructor-drop-zone';
import { BurgerConstructorIngredient } from '@components/burger-constructor-ingredient/burger-constructor-ingredient';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import {
  selectCanOrder,
  selectConstructorState,
  selectOrderPrice,
} from '@services/constructor/constructor-slice';
import { openOrderModal } from '@services/modal/modal-slice';

import styles from './burger-constructor.module.css';

export const BurgerConstructor = memo(function BurgerConstructor(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { bun, ingredients } = useAppSelector(selectConstructorState);
  const orderPrice = useAppSelector(selectOrderPrice);
  const canOrder = useAppSelector(selectCanOrder);
  const moveInstructionsId = useId();
  const [moveAnnouncement, setMoveAnnouncement] = useState('');
  const handleMoveAnnouncement = useCallback((message: string): void => {
    setMoveAnnouncement(message);
  }, []);
  const handleBunDragStartCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
    },
    []
  );
  const handleOrderClick = useCallback((): void => {
    if (!canOrder) return;

    dispatch(openOrderModal({ orderNumber: '034536' }));
  }, [canOrder, dispatch]);

  console.log('BurgerConstructor', bun, ingredients);

  return (
    <section className={styles.burger_constructor}>
      <p id={moveInstructionsId} className={styles.visually_hidden}>
        Нажмите Enter или пробел, чтобы начать перемещение. Стрелки вверх и вниз меняют
        позицию ингредиента. Enter, пробел, Escape или Tab завершают перемещение,
        сохраняя новый порядок.
      </p>
      <div
        className={styles.visually_hidden}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {moveAnnouncement}
      </div>
      <BurgerConstructorDropZone>
        <div
          className={`${styles.burger_item} ${styles.burger_item_locked}`}
          onDragStartCapture={handleBunDragStartCapture}
        >
          {!bun ? (
            <div
              className={`${styles.placeholder} ${styles.placeholder_top} text text_type_main-default`}
            >
              Выберите булки
            </div>
          ) : (
            <ConstructorElement
              isLocked={true}
              price={bun.price}
              text={`${bun.name} (верх)`}
              thumbnail={bun.image_mobile}
              type={'top'}
            />
          )}
        </div>

        <div className={`${styles.burger_items} custom-scroll`}>
          {ingredients.length === 0 ? (
            <div className={`${styles.burger_item} pl-8`}>
              <div className={`${styles.placeholder} text text_type_main-default`}>
                Выберите начинку
              </div>
            </div>
          ) : (
            ingredients.map(({ id, ingredient }) => (
              <BurgerConstructorIngredient
                key={id}
                id={id}
                ingredient={ingredient}
                instructionsId={moveInstructionsId}
                onAnnounce={handleMoveAnnouncement}
              />
            ))
          )}
        </div>

        <div
          className={`${styles.burger_item} ${styles.burger_item_locked}`}
          onDragStartCapture={handleBunDragStartCapture}
        >
          {!bun ? (
            <div
              className={`${styles.placeholder} ${styles.placeholder_bottom} text text_type_main-default`}
            >
              Перетащите сюда булку
            </div>
          ) : (
            <ConstructorElement
              isLocked={true}
              price={bun.price}
              text={`${bun.name} (низ)`}
              thumbnail={bun.image_mobile}
              type={'bottom'}
            />
          )}
        </div>
      </BurgerConstructorDropZone>

      <div className={`${styles.burger_price} mr-4 ml-4`}>
        <div className={styles.burger_price_value}>
          <div className="text text_type_digits-medium">{orderPrice}</div>
          <span className={styles.visually_hidden}> кредитов</span>
          <span aria-hidden="true">
            <CurrencyIcon type="primary" />
          </span>
        </div>

        <Button
          onClick={handleOrderClick}
          disabled={!canOrder}
          size="large"
          type="primary"
          htmlType={'button'}
        >
          Оформить заказ
        </Button>
      </div>
    </section>
  );
});
