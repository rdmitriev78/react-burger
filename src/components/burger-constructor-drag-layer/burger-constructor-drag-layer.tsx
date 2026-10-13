import {
  ConstructorElement,
  DragIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { useDragLayer } from 'react-dnd';
import { createPortal } from 'react-dom';

import { constructorIngredientDndType } from '@utils/dnd';

import type { TConstructorIngredientDragItem } from '@utils/dnd';
import type { XYCoord } from 'react-dnd';

import styles from './burger-constructor-drag-layer.module.css';

type TDragLayerCollectedProps = {
  item: TConstructorIngredientDragItem | null;
  isDragging: boolean;
  initialOffset: XYCoord | null;
  currentOffset: XYCoord | null;
};

const inactiveDragLayerState: TDragLayerCollectedProps = {
  item: null,
  isDragging: false,
  initialOffset: null,
  currentOffset: null,
};

export const BurgerConstructorDragLayer = (): React.JSX.Element | null => {
  const { item, isDragging, initialOffset, currentOffset } = useDragLayer(
    (monitor): TDragLayerCollectedProps => {
      if (
        !monitor.isDragging() ||
        monitor.getItemType() !== constructorIngredientDndType
      ) {
        return inactiveDragLayerState;
      }

      return {
        item: monitor.getItem<TConstructorIngredientDragItem>(),
        isDragging: true,
        initialOffset: monitor.getInitialClientOffset(),
        currentOffset: monitor.getClientOffset(),
      };
    }
  );

  if (!isDragging || !item || !initialOffset || !currentOffset) return null;

  const { ingredient, preview } = item;
  // Начальная позиция сохраняется: исходная строка может переместиться во время drag.
  const x = preview.x + currentOffset.x - initialOffset.x;
  const y = preview.y + currentOffset.y - initialOffset.y;

  return createPortal(
    <div className={styles.drag_layer} aria-hidden="true" inert>
      <div
        className={styles.preview}
        style={{ width: preview.width, transform: `translate(${x}px, ${y}px)` }}
      >
        <span className={styles.drag_icon}>
          <DragIcon type="primary" />
        </span>
        <ConstructorElement
          price={ingredient.price}
          text={ingredient.name}
          thumbnail={ingredient.image_mobile}
        />
      </div>
    </div>,
    document.body
  );
};
