export type TIngredientBase = {
  _id: string;
  name: string;
  proteins: number;
  fat: number;
  carbohydrates: number;
  calories: number;
  price: number;
  image: string;
  image_large: string;
  image_mobile: string;
  __v: number;
};

export type TBunIngredient = TIngredientBase & {
  type: 'bun';
};

export type TFillingIngredient = TIngredientBase & {
  type: 'main' | 'sauce';
};

export type TIngredient = TBunIngredient | TFillingIngredient;

export type TIngredientCounts = ReadonlyMap<string, number>;

export type TConstructorIngredient = {
  id: string;
  ingredient: TFillingIngredient;
};

export type TConstructorState = {
  bun: TBunIngredient;
  ingredients: TConstructorIngredient[];
};
