import { createSelector } from '@reduxjs/toolkit';

import { burgerApi } from '@services/api/burger-api';

import type { TIngredient } from '@app-types/ingredient';
import type { RootState } from '@services/store';

const selectIngredientsQuery = burgerApi.endpoints.getIngredients.select(undefined);

export const selectIngredients = (state: RootState): TIngredient[] | undefined =>
  selectIngredientsQuery(state).data;

export const selectIngredientById = (
  state: RootState,
  id: string | undefined
): TIngredient | undefined =>
  selectIngredients(state)?.find((ingredient) => ingredient._id === id);

export const selectIngredientsByType = createSelector(
  [selectIngredients],
  (ingredients): Record<TIngredient['type'], TIngredient[]> => {
    const grouped: Record<TIngredient['type'], TIngredient[]> = {
      bun: [],
      main: [],
      sauce: [],
    };

    for (const ingredient of ingredients ?? []) {
      grouped[ingredient.type].push(ingredient);
    }

    return grouped;
  }
);
