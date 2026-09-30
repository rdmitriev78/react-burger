import { Counter, CurrencyIcon } from '@krgaa/react-developer-burger-ui-components';
import { useId } from 'react';

import type { TIngredient } from '@utils/types';

import styles from './burger-ingredient.module.css';

type TBurgerIngredientProps = {
  ingredient: TIngredient;
  count: number;
  onClick: () => void;
};

export const BurgerIngredient = ({
  ingredient,
  count,
  onClick,
}: TBurgerIngredientProps): React.JSX.Element => {
  const nameId = useId();
  const descriptionId = useId();

  return (
    <button
      className={styles.product}
      type="button"
      aria-labelledby={nameId}
      aria-describedby={descriptionId}
      onClick={onClick}
    >
      <img
        className={`${styles.product_image} pr-4 pl-4 mb-1`}
        src={ingredient.image_large}
        alt=""
      />

      <div className={`${styles.product_price} mb-1`} aria-hidden="true">
        <span className="text text_type_digits-default mr-2">{ingredient.price}</span>
        <CurrencyIcon type="primary" />
      </div>

      <div id={nameId} className={`${styles.product_name} text text_type_main-default`}>
        {ingredient.name}
      </div>

      {count > 0 && (
        <span aria-hidden="true">
          <Counter count={count} size="default" />
        </span>
      )}

      <span id={descriptionId} className={styles.visually_hidden}>
        Цена: {ingredient.price} кредитов.
        {count > 0 && ` В конструкторе: ${count}.`}
      </span>
    </button>
  );
};
