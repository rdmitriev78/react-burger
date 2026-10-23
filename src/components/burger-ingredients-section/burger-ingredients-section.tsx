import { memo } from 'react';

import { useAppSelector } from '@hooks/redux';
import { selectIngredientCounts } from '@services/constructor/constructor-slice';

import { BurgerIngredient } from '../burger-ingredient/burger-ingredient';

import type { TIngredient } from '@app-types/ingredient';

import styles from './burger-ingredients-section.module.css';

type TBurgerIngredientsSectionProps = {
  title: string;
  ingredients: TIngredient[];
  onIngredientClick: (ingredient: TIngredient) => void;
};

export const BurgerIngredientsSection = memo(function BurgerIngredientsSection({
  title,
  ingredients,
  onIngredientClick,
}: TBurgerIngredientsSectionProps): React.JSX.Element {
  const ingredientCounts = useAppSelector(selectIngredientCounts);
  console.log('BurgerIngredientsSection', ingredients);

  return (
    <>
      <h2 className={styles.menu_item_title}>{title}</h2>

      <div className={`${styles.products} pt-6 pr-1 pb-10 pl-4`}>
        {ingredients.map((ingredient) => (
          <BurgerIngredient
            key={ingredient._id}
            ingredient={ingredient}
            count={ingredientCounts.get(ingredient._id) ?? 0}
            onClick={onIngredientClick}
          />
        ))}
      </div>
    </>
  );
});
