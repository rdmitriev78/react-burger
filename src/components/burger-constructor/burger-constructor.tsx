import {
  Button,
  ConstructorElement,
  CurrencyIcon,
  DragIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { memo } from 'react';

import type { TIngredient } from '@utils/types';

import styles from './burger-constructor.module.css';

type TBurgerConstructorProps = {
  ingredients: TIngredient[];
  onOrderClick: () => void;
};

export const BurgerConstructor = memo(function BurgerConstructor({
  ingredients,
  onOrderClick,
}: TBurgerConstructorProps): React.JSX.Element {
  console.log('BurgerConstructor', ingredients);

  // ранний возврат, если нет ингредиентов для конструктора
  if (ingredients.length === 0) {
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

  return (
    <section className={styles.burger_constructor}>
      <div className={`${styles.burger_structure} mb-10 ml-4`}>
        <div className={`${styles.burger_item} ${styles.burger_item_locked}`}>
          <ConstructorElement
            isLocked={true}
            price={ingredients[0].price}
            text={`${ingredients[0].name} (верх)`}
            thumbnail={ingredients[0].image_mobile}
            type={'top'}
          />
        </div>

        <div className={`${styles.burger_items} custom-scroll`}>
          {ingredients.slice(1).map((ingredient) => {
            return (
              <div key={ingredient._id} className={styles.burger_item}>
                <DragIcon type="primary" />

                <ConstructorElement
                  handleClose={(): void => {
                    console.log(`handleClose to ${ingredient.name}`);
                  }}
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
            price={ingredients[0].price}
            text={`${ingredients[0].name} (низ)`}
            thumbnail={ingredients[0].image_mobile}
            type={'bottom'}
          />
        </div>
      </div>

      <div className={`${styles.burger_price} mr-4 ml-4`}>
        <div className={styles.burger_price_value}>
          <div className="text text_type_digits-medium">610</div>
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
