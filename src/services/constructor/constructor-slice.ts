import { createSelector, createSlice, nanoid } from '@reduxjs/toolkit';

import type { TBunIngredient, TFillingIngredient } from '@app-types/ingredient';
import type { PayloadAction } from '@reduxjs/toolkit';

type TIngredientCounts = ReadonlyMap<string, number>;

type TConstructorIngredient = {
  id: string;
  ingredient: TFillingIngredient;
};

type TConstructorState = {
  bun: TBunIngredient | null;
  ingredients: TConstructorIngredient[];
};

const createInitialState = (): TConstructorState => ({
  bun: null,
  ingredients: [],
});

const areIngredientCountsEqual = (
  previous: TIngredientCounts,
  next: TIngredientCounts
): boolean => {
  if (previous === next) return true;
  if (previous.size !== next.size) return false;

  for (const [id, count] of previous) {
    if (next.get(id) !== count) return false;
  }

  return true;
};

const constructorSlice = createSlice({
  name: 'burgerConstructor',
  initialState: createInitialState,
  reducers: {
    setBun: (state, action: PayloadAction<TBunIngredient>): void => {
      state.bun = action.payload;
    },
    addIngredient: {
      prepare: (
        ingredient: TFillingIngredient
      ): { payload: TConstructorIngredient } => ({
        payload: { id: nanoid(), ingredient },
      }),
      reducer: (state, action: PayloadAction<TConstructorIngredient>): void => {
        state.ingredients.push(action.payload);
      },
    },
    removeIngredient: (state, action: PayloadAction<string>): void => {
      state.ingredients = state.ingredients.filter(({ id }) => id !== action.payload);
    },
    moveIngredient: (
      state,
      action: PayloadAction<{ draggedId: string; targetId: string }>
    ): void => {
      const { draggedId, targetId } = action.payload;
      if (draggedId === targetId) return;

      const fromIndex = state.ingredients.findIndex(({ id }) => id === draggedId);
      const toIndex = state.ingredients.findIndex(({ id }) => id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const [ingredient] = state.ingredients.splice(fromIndex, 1);
      state.ingredients.splice(toIndex, 0, ingredient);
    },
    resetConstructor: (): TConstructorState => createInitialState(),
  },
  selectors: {
    selectConstructorState: (state): TConstructorState => state,
    selectOrderPrice: createSelector(
      [(state: TConstructorState): TConstructorState => state],
      ({ bun, ingredients }): number =>
        ingredients.reduce(
          (total, { ingredient }) => total + ingredient.price,
          bun ? bun.price * 2 : 0
        )
    ),
    selectIngredientCounts: createSelector(
      [(state: TConstructorState): TConstructorState => state],
      ({ bun, ingredients }): TIngredientCounts => {
        const counts = new Map<string, number>();

        if (bun) counts.set(bun._id, 2);

        for (const { ingredient } of ingredients) {
          counts.set(ingredient._id, (counts.get(ingredient._id) ?? 0) + 1);
        }

        return counts;
      },
      {
        memoizeOptions: {
          // При перестановке количество не меняется: возвращаем прежний Map,
          // чтобы подписанные на счётчики разделы каталога не перерисовывались.
          resultEqualityCheck: areIngredientCountsEqual,
        },
      }
    ),
    selectCanOrder: ({ bun, ingredients }): boolean =>
      bun !== null && ingredients.length > 0,
  },
});

export const {
  setBun,
  addIngredient,
  removeIngredient,
  moveIngredient,
  resetConstructor,
} = constructorSlice.actions;
export const constructorReducer = constructorSlice.reducer;

export const {
  selectConstructorState,
  selectOrderPrice,
  selectIngredientCounts,
  selectCanOrder,
} = constructorSlice.selectors;
