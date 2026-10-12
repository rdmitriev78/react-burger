import {
  Button,
  ConstructorElement,
  CurrencyIcon,
  DragIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { memo, useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@hooks/redux';
import {
  removeIngredient,
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
  const handleOrderClick = useCallback((): void => {
    if (!canOrder) return;

    dispatch(openOrderModal({ orderNumber: '034536' }));
  }, [canOrder, dispatch]);

  console.log('BurgerConstructor', bun, ingredients);

  return (
    <section className={styles.burger_constructor}>
      <div className={`${styles.burger_structure} mb-10 ml-4`}>
        <div className={`${styles.burger_item} ${styles.burger_item_locked}`}>
          {!bun ? (
            <div
              className={`${styles.placeholder} ${styles.placeholder_top} text text_type_main-default`}
            >
              Перетащите сюда булку
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
                Перетащите сюда ингредиенты
              </div>
            </div>
          ) : (
            ingredients.map(({ id, ingredient }) => (
              <div key={id} className={styles.burger_item}>
                <DragIcon type="primary" />

                <ConstructorElement
                  handleClose={() => dispatch(removeIngredient(id))}
                  price={ingredient.price}
                  text={ingredient.name}
                  thumbnail={ingredient.image_mobile}
                />
              </div>
            ))
          )}
        </div>

        <div className={`${styles.burger_item} ${styles.burger_item_locked}`}>
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
      </div>

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
