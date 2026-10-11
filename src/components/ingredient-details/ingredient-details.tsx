import type { TIngredient } from '@utils/types';

import styles from './ingredient-details.module.css';

type TIngredientDetailsProps = {
  ingredient: TIngredient;
};

export const IngredientDetails = ({
  ingredient,
}: TIngredientDetailsProps): React.JSX.Element => {
  const nutrients = [
    { label: 'Калории, ккал', value: ingredient.calories },
    { label: 'Белки, г', value: ingredient.proteins },
    { label: 'Жиры, г', value: ingredient.fat },
    { label: 'Углеводы, г', value: ingredient.carbohydrates },
  ];

  return (
    <div className={styles.details}>
      <img className={styles.image} src={ingredient.image_large} alt={ingredient.name} />
      <h3 className="text text_type_main-medium mt-4 mb-8">{ingredient.name}</h3>
      <dl className={styles.nutrients}>
        {nutrients.map(({ label, value }) => (
          <div key={label}>
            <dt className="text text_type_main-default text_color_inactive">{label}</dt>
            <dd
              className={`${styles.value} text text_type_digits-default text_color_inactive mt-2`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
