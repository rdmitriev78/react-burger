import { Counter, CurrencyIcon } from '@krgaa/react-developer-burger-ui-components';
import { memo, useCallback, useId, useRef } from 'react';
import { useDrag } from 'react-dnd';

import { catalogIngredientDndType } from '@utils/dnd';

import type { TIngredient } from '@app-types/ingredient';
import type { TCatalogIngredientDragItem } from '@utils/dnd';

import styles from './burger-ingredient.module.css';

type TBurgerIngredientProps = {
  ingredient: TIngredient;
  count: number;
  onClick: (ingredient: TIngredient) => void;
};

export const BurgerIngredient = memo(function BurgerIngredient({
  ingredient,
  count,
  onClick,
}: TBurgerIngredientProps): React.JSX.Element {
  const nameId = useId();
  const descriptionId = useId();
  const dragStartedRef = useRef(false);
  const [{ isDragging }, drag] = useDrag<
    TCatalogIngredientDragItem,
    void,
    { isDragging: boolean }
  >(
    () => ({
      type: catalogIngredientDndType,
      item: (): TCatalogIngredientDragItem => {
        dragStartedRef.current = true;
        return { ingredient };
      },
      collect: (monitor): { isDragging: boolean } => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [ingredient]
  );
  const dragRef = useCallback(
    (node: HTMLButtonElement | null): void => {
      drag(node);
    },
    [drag]
  );

  return (
    <button
      ref={dragRef}
      className={`${styles.product} ${isDragging ? styles.product_dragging : ''}`}
      type="button"
      aria-labelledby={nameId}
      aria-describedby={descriptionId}
      onPointerDown={() => {
        dragStartedRef.current = false;
      }}
      onClick={(event) => {
        // После перетаскивания не открываем детали по завершающему клику указателя.
        // Активацию с клавиатуры (detail === 0) пропускаем независимо от dragStartedRef.
        if (event.detail > 0 && dragStartedRef.current) {
          dragStartedRef.current = false;
          return;
        }

        onClick(ingredient);
      }}
    >
      <img
        className={`${styles.product_image} pr-4 pl-4 mb-1`}
        src={ingredient.image_large}
        alt={ingredient.name}
        draggable={false}
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
});
