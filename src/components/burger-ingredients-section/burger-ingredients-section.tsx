import { BurgerIngredient } from '../burger-ingredient/burger-ingredient';

import type { TIngredient, TIngredientCounts } from '@utils/types';

import styles from './burger-ingredients-section.module.css';

type TBurgerIngredientsSectionProps = {
  title: string;
  ingredients: TIngredient[];
  ingredientCounts: TIngredientCounts;
  onIngredientClick: (ingredient: TIngredient) => void;
};

export const BurgerIngredientsSection = ({
  title,
  ingredients,
  ingredientCounts,
  onIngredientClick,
}: TBurgerIngredientsSectionProps): React.JSX.Element => (
  <section>
    <h2 className={styles.menu_item_title}>{title}</h2>

    <div className={`${styles.products} pt-6 pr-1 pb-10 pl-4`}>
      {ingredients.map((ingredient) => (
        <BurgerIngredient
          key={ingredient._id}
          ingredient={ingredient}
          count={ingredientCounts.get(ingredient._id) ?? 0}
          onClick={(): void => onIngredientClick(ingredient)}
        />
      ))}
    </div>
  </section>
);
