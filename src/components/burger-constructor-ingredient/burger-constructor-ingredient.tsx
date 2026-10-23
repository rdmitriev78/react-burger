import {
  ConstructorElement,
  DragIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

import { useAppDispatch, useAppStore } from '@hooks/redux';
import { useKeyboardIngredientMove } from '@hooks/use-keyboard-ingredient-move';
import {
  moveIngredient,
  removeIngredient,
  selectConstructorState,
} from '@services/constructor/constructor-slice';
import { constructorIngredientDndType } from '@utils/dnd';

import type { TFillingIngredient } from '@app-types/ingredient';
import type { TConstructorIngredientDragItem } from '@utils/dnd';

import styles from './burger-constructor-ingredient.module.css';

type TBurgerConstructorIngredientProps = {
  id: string;
  ingredient: TFillingIngredient;
  instructionsId: string;
  onAnnounce: (message: string) => void;
};

export const BurgerConstructorIngredient = memo(function BurgerConstructorIngredient({
  id,
  ingredient,
  instructionsId,
  onAnnounce,
}: TBurgerConstructorIngredientProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const [{ isDragging }, drag, preview] = useDrag<
    TConstructorIngredientDragItem,
    void,
    { isDragging: boolean }
  >(
    () => ({
      type: constructorIngredientDndType,
      item: (): TConstructorIngredientDragItem | null => {
        const row = rowRef.current;
        if (!row) return null;

        const { x, y, width } = row.getBoundingClientRect();
        return { id, ingredient, preview: { x, y, width } };
      },
      collect: (monitor): { isDragging: boolean } => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [id, ingredient]
  );
  useEffect(() => {
    // Превью рисует отдельный слой, независимо от перестановки и прокрутки строк.
    preview(getEmptyImage(), { captureDraggingState: true });
    return (): void => {
      preview(null);
    };
  }, [preview]);

  const { isKeyboardMoving, finishKeyboardMove, handleKeyDown, handleClick } =
    useKeyboardIngredientMove({
      id,
      ingredientName: ingredient.name,
      isDragging,
      rowRef,
      dragHandleRef,
      onAnnounce,
    });

  const [, drop] = useDrop<TConstructorIngredientDragItem>(
    () => ({
      accept: constructorIngredientDndType,
      hover: ({ id: draggedId }, monitor): void => {
        const row = rowRef.current;
        const clientOffset = monitor.getClientOffset();
        if (!row || !clientOffset || draggedId === id) return;

        // Читаем текущий порядок при каждом hover: он уже мог измениться до рендера.
        const { ingredients } = selectConstructorState(store.getState());
        const fromIndex = ingredients.findIndex(({ id }) => id === draggedId);
        const toIndex = ingredients.findIndex(({ id: targetId }) => targetId === id);
        if (fromIndex === -1 || toIndex === -1) return;

        const bounds = row.getBoundingClientRect();
        const middleY = (bounds.bottom - bounds.top) / 2;
        const pointerY = clientOffset.y - bounds.top;
        // Переставляем только после пересечения середины строки в направлении движения,
        // чтобы ингредиенты не менялись местами туда-сюда у границы строк.
        if (fromIndex < toIndex && pointerY < middleY) return;
        if (fromIndex > toIndex && pointerY > middleY) return;

        dispatch(moveIngredient({ draggedId, targetId: id }));
      },
    }),
    [dispatch, id, store]
  );
  const connectRowRef = useCallback(
    (node: HTMLDivElement | null): void => {
      rowRef.current = node;
      drop(node);
    },
    [drop]
  );
  const dragRef = useCallback(
    (node: HTMLButtonElement | null): void => {
      dragHandleRef.current = node;
      drag(node);
    },
    [drag]
  );
  const handleDragStartCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (
        !(event.target instanceof Node) ||
        !dragHandleRef.current?.contains(event.target)
      ) {
        // Запрещаем нативное перетаскивание картинки и выделенного текста.
        event.preventDefault();
        return;
      }

      finishKeyboardMove();
    },
    [finishKeyboardMove]
  );
  const handleClose = useCallback((): void => {
    dispatch(removeIngredient(id));
  }, [dispatch, id]);

  return (
    <div
      ref={connectRowRef}
      className={`${styles.burger_item} ${isDragging ? styles.burger_item_dragging : ''}`}
      onDragStartCapture={handleDragStartCapture}
    >
      <button
        ref={dragRef}
        className={`${styles.drag_handle} ${isKeyboardMoving ? styles.drag_handle_moving : ''}`}
        type="button"
        aria-label={`Переместить ${ingredient.name}`}
        aria-describedby={instructionsId}
        aria-pressed={isKeyboardMoving}
        onKeyDown={handleKeyDown}
        onBlur={finishKeyboardMove}
        onClick={handleClick}
      >
        <DragIcon type="primary" />
      </button>

      <ConstructorElement
        handleClose={handleClose}
        price={ingredient.price}
        text={ingredient.name}
        thumbnail={ingredient.image_mobile}
      />
    </div>
  );
});
