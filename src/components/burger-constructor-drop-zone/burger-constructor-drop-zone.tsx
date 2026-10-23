import { useCallback } from 'react';
import { useDrop } from 'react-dnd';

import { useAppDispatch } from '@hooks/redux';
import { addIngredient, setBun } from '@services/constructor/constructor-slice';
import { catalogIngredientDndType } from '@utils/dnd';

import type { TCatalogIngredientDragItem } from '@utils/dnd';
import type { ReactNode } from 'react';

import styles from './burger-constructor-drop-zone.module.css';

type TBurgerConstructorDropZoneProps = {
  children: ReactNode;
};

export const BurgerConstructorDropZone = ({
  children,
}: TBurgerConstructorDropZoneProps): React.JSX.Element => {
  const dispatch = useAppDispatch();
  const [{ isOver }, drop] = useDrop<
    TCatalogIngredientDragItem,
    void,
    { isOver: boolean }
  >(
    () => ({
      accept: catalogIngredientDndType,
      drop: ({ ingredient }): void => {
        if (ingredient.type === 'bun') {
          dispatch(setBun(ingredient));
        } else {
          dispatch(addIngredient(ingredient));
        }
      },
      collect: (monitor): { isOver: boolean } => ({
        isOver: monitor.isOver() && monitor.canDrop(),
      }),
    }),
    [dispatch]
  );
  const dropRef = useCallback(
    (node: HTMLDivElement | null): void => {
      drop(node);
    },
    [drop]
  );

  return (
    <div
      ref={dropRef}
      className={`${styles.burger_structure} ${isOver ? styles.burger_structure_hover : ''} mb-10 ml-4`}
    >
      {children}
    </div>
  );
};
