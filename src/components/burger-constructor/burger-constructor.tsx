import {
  Button,
  ConstructorElement,
  CurrencyIcon,
  DragIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { memo } from 'react';

import { useOrderPrice } from '@hooks/use-order-price';

import type { TConstructorState } from '@utils/types';

import styles from './burger-constructor.module.css';

type TBurgerConstructorProps = {
  constructorState: TConstructorState | null;
  onOrderClick: () => void;
  onIngredientRemove: (id: string) => void;
};

export const BurgerConstructor = memo(function BurgerConstructor({
  constructorState,
  onOrderClick,
  onIngredientRemove,
}: TBurgerConstructorProps): React.JSX.Element {
  const orderPrice = useOrderPrice(constructorState);

  console.log('BurgerConstructor', constructorState?.ingredients);
  // ранний возврат, если нет ингредиентов для конструктора
  if (!constructorState) {
    return (
      <section className={styles.burger_constructor}>
        <p
          className={`${styles.text_placeholder} text text_type_main-medium text_color_inactive mt-20 ml-4`}
        >
          Добавьте ингредиенты
        </p>
      </section>
    );
  }

  const { bun, ingredients } = constructorState;

  return (
    <section className={styles.burger_constructor}>
      <div className={`${styles.burger_structure} mb-10 ml-4`}>
        <div className={`${styles.burger_item} ${styles.burger_item_locked}`}>
          <ConstructorElement
            isLocked={true}
            price={bun.price}
            text={`${bun.name} (верх)`}
            thumbnail={bun.image_mobile}
            type={'top'}
          />
        </div>

        <div className={`${styles.burger_items} custom-scroll`}>
          {ingredients.map(({ id, ingredient }) => {
            return (
              <div key={id} className={styles.burger_item}>
                <DragIcon type="primary" />

                <ConstructorElement
                  handleClose={() => onIngredientRemove(id)}
                  price={ingredient.price}
                  text={ingredient.name}
                  thumbnail={ingredient.image_mobile}
                />
              </div>
            );
          })}
        </div>

        <div className={`${styles.burger_item} ${styles.burger_item_locked}`}>
          <ConstructorElement
            isLocked={true}
            price={bun.price}
            text={`${bun.name} (низ)`}
            thumbnail={bun.image_mobile}
            type={'bottom'}
          />
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

        <Button onClick={onOrderClick} size="large" type="primary" htmlType={'button'}>
          Оформить заказ
        </Button>
      </div>
    </section>
  );
});
