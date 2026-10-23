import type { TFillingIngredient, TIngredient } from '@app-types/ingredient';

// Разные типы разделяют добавление из каталога и перестановку в конструкторе:
// перемещение уже добавленного экземпляра не должно добавлять его повторно.
export const catalogIngredientDndType = 'catalog-ingredient';
export const constructorIngredientDndType = 'constructor-ingredient';

export type TCatalogIngredientDragItem = {
  ingredient: TIngredient;
};

export type TConstructorIngredientDragItem = {
  id: string;
  ingredient: TFillingIngredient;
  preview: {
    x: number;
    y: number;
    width: number;
  };
};
