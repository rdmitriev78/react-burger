import { useCallback, useLayoutEffect, useState } from 'react';

import { useAppDispatch, useAppStore } from '@hooks/redux';
import {
  moveIngredient,
  selectConstructorState,
} from '@services/constructor/constructor-slice';
import { isVirtualClick } from '@utils/events';

import type { KeyboardEvent, MouseEvent, RefObject } from 'react';

type TKeyboardIngredientMoveOptions = {
  id: string;
  ingredientName: string;
  isDragging: boolean;
  rowRef: RefObject<HTMLDivElement | null>;
  dragHandleRef: RefObject<HTMLButtonElement | null>;
  onAnnounce: (message: string) => void;
};

type TKeyboardIngredientMove = {
  isKeyboardMoving: boolean;
  finishKeyboardMove: () => void;
  handleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  handleClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

export const useKeyboardIngredientMove = ({
  id,
  ingredientName,
  isDragging,
  rowRef,
  dragHandleRef,
  onAnnounce,
}: TKeyboardIngredientMoveOptions): TKeyboardIngredientMove => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const [keyboardMovePosition, setKeyboardMovePosition] = useState<number | null>(null);
  const isKeyboardMoving = keyboardMovePosition !== null;

  useLayoutEffect(() => {
    if (keyboardMovePosition === null) return;

    // При перестановке DOM-узла браузер может потерять фокус.
    dragHandleRef.current?.focus({ preventScroll: true });
    rowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [dragHandleRef, keyboardMovePosition, rowRef]);

  const finishKeyboardMove = useCallback((): void => {
    if (!isKeyboardMoving) return;

    setKeyboardMovePosition(null);
    onAnnounce(`Перемещение завершено. ${ingredientName}.`);
  }, [ingredientName, isKeyboardMoving, onAnnounce]);

  const toggleKeyboardMove = useCallback((): void => {
    if (isDragging) return;
    if (isKeyboardMoving) {
      finishKeyboardMove();
      return;
    }

    const { ingredients } = selectConstructorState(store.getState());
    const index = ingredients.findIndex((item) => item.id === id);
    if (index === -1) return;

    dragHandleRef.current?.focus({ preventScroll: true });
    setKeyboardMovePosition(index);
    onAnnounce(
      `Перемещение ${ingredientName}. Позиция ${index + 1} из ${ingredients.length}. Используйте стрелки вверх и вниз.`
    );
  }, [
    dragHandleRef,
    finishKeyboardMove,
    id,
    ingredientName,
    isDragging,
    isKeyboardMoving,
    onAnnounce,
    store,
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key === 'Tab') {
        finishKeyboardMove();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === 'Enter' || event.key === ' ') {
        // Подавляем нативный click после Enter/Space, иначе режим переключится дважды.
        // Виртуальный click от вспомогательных технологий обрабатывает handleClick.
        event.preventDefault();
        if (!event.repeat) toggleKeyboardMove();
        return;
      }
      if (!isKeyboardMoving) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        finishKeyboardMove();
        return;
      }
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      event.preventDefault();
      const { ingredients } = selectConstructorState(store.getState());
      const fromIndex = ingredients.findIndex((item) => item.id === id);
      if (fromIndex === -1) return;

      const toIndex = fromIndex + (event.key === 'ArrowUp' ? -1 : 1);
      const target = ingredients[toIndex];
      if (!target) return;

      dispatch(moveIngredient({ draggedId: id, targetId: target.id }));
      setKeyboardMovePosition(toIndex);
      onAnnounce(`${ingredientName}. Позиция ${toIndex + 1} из ${ingredients.length}.`);
    },
    [
      dispatch,
      finishKeyboardMove,
      id,
      ingredientName,
      isKeyboardMoving,
      onAnnounce,
      store,
      toggleKeyboardMove,
    ]
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      if (isVirtualClick(event.nativeEvent)) toggleKeyboardMove();
    },
    [toggleKeyboardMove]
  );

  return { isKeyboardMoving, finishKeyboardMove, handleKeyDown, handleClick };
};
