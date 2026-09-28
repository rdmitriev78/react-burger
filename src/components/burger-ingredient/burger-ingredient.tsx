import { Counter, CurrencyIcon } from '@krgaa/react-developer-burger-ui-components';

import type { TIngredient } from '@utils/types';

import styles from './burger-ingredient.module.css';

type TBurgerIngredientProps = {
  ingredient: TIngredient;
  count: number;
};

export const BurgerIngredient = ({
  ingredient,
  count,
}: TBurgerIngredientProps): React.JSX.Element => (
  <article className={styles.product}>
    <img
      className={`${styles.product_image} pr-4 pl-4 mb-1`}
      src={ingredient.image_large}
      alt={ingredient.name}
    />

    <div className={`${styles.product_price} mb-1`}>
      <span className="text text_type_digits-default mr-2">{ingredient.price}</span>
      <CurrencyIcon type="primary" />
    </div>

    <div className={`${styles.product_name} text text_type_main-default`}>
      {ingredient.name}
    </div>

    {count > 0 && <Counter count={count} size="default" />}
  </article>
);
