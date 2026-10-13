import type { TFillingIngredient, TIngredient } from '@app-types/ingredient';

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
