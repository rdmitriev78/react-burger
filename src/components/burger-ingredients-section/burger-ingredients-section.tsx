import { memo, useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { selectIngredientCounts } from '@services/constructor/constructor-slice';
import { openIngredientModal } from '@services/modal/modal-slice';

import { BurgerIngredient } from '../burger-ingredient/burger-ingredient';

import type { TIngredient } from '@app-types/ingredient';

import styles from './burger-ingredients-section.module.css';

type TBurgerIngredientsSectionProps = {
  title: string;
  ingredients: TIngredient[];
};

export const BurgerIngredientsSection = memo(function BurgerIngredientsSection({
  title,
  ingredients,
}: TBurgerIngredientsSectionProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const ingredientCounts = useAppSelector(selectIngredientCounts);
  const handleIngredientClick = useCallback(
    (ingredient: TIngredient): void => {
      dispatch(openIngredientModal(ingredient));
    },
    [dispatch]
  );
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
            onClick={handleIngredientClick}
          />
        ))}
      </div>
    </>
  );
});
