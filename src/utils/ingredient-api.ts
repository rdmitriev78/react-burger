import type { TIngredient } from './types';

const API = 'https://new-stellarburgers.education-services.ru/api/ingredients';
export const DEFAULT_INGREDIENT_ERROR = 'Ошибка при получении ингредиентов';

type TIngredientsResponse = {
  success: boolean;
  data: TIngredient[];
};

export const getIngredients = async (signal: AbortSignal): Promise<TIngredient[]> => {
  const response = await fetch(API, { signal });

  if (!response.ok) {
    throw Error(`${DEFAULT_INGREDIENT_ERROR}. Ошибка сети!`);
  }

  const { success, data } = (await response.json()) as TIngredientsResponse;

  if (!success) {
    throw Error(`${DEFAULT_INGREDIENT_ERROR}. Ошибка сервера!`);
  }

  if (!data || data.length === 0) {
    throw Error(`${DEFAULT_INGREDIENT_ERROR}. Ингредиенты не получены!`);
  }

  return data;
};
