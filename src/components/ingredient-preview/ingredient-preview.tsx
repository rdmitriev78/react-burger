import type { TIngredient } from '@app-types/ingredient';

import styles from './ingredient-preview.module.css';

type TIngredientPreviewProps = { ingredient: TIngredient; hiddenCount?: number };

export const IngredientPreview = ({
  ingredient,
  hiddenCount,
}: TIngredientPreviewProps): React.JSX.Element => (
  <span className={styles.preview}>
    <img src={ingredient.image_mobile} alt={ingredient.name} />
    {hiddenCount !== undefined && (
      <span className={`${styles.counter} text text_type_main-default`}>
        +{hiddenCount}
      </span>
    )}
  </span>
);
