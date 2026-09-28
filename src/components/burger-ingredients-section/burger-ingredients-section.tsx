import { BurgerIngredient } from '../burger-ingredient/burger-ingredient';

import type { TIngredient } from '@utils/types';

import styles from './burger-ingredients-section.module.css';

type TBurgerIngredientsSectionProps = {
  title: string;
  ingredients: TIngredient[];
};

export const BurgerIngredientsSection = ({
  title,
  ingredients,
}: TBurgerIngredientsSectionProps): React.JSX.Element => (
  <section>
    <h2 className={styles.menu_item_title}>{title}</h2>

    <div className={`${styles.products} pt-6 pr-1 pb-10 pl-4`}>
      {ingredients.map((ingredient) => (
        <BurgerIngredient key={ingredient._id} ingredient={ingredient} count={0} />
      ))}
    </div>
  </section>
);
