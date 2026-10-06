import type { TIngredient } from './types';

const API = 'https://new-stellarburgers.education-services.ru/api/ingredients';

type TIngredientsResponse = {
  success: boolean;
  data: TIngredient[];
};

export const getIngredients = async (signal: AbortSignal): Promise<TIngredient[]> => {
  const GET_INGREDIENTS_ERROR = 'Ошибка при получении ингредиентов';

  const response = await fetch(API, { signal });

  if (!response.ok) {
    const httpStatus = `${response.status} ${response.statusText}`.trim();

    throw new Error(`${GET_INGREDIENTS_ERROR}. HTTP ${httpStatus}`);
  }

  const { success, data } = (await response.json()) as TIngredientsResponse;

  if (!success) {
    throw Error(`${GET_INGREDIENTS_ERROR}. Ошибка сервера!`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw Error(`${GET_INGREDIENTS_ERROR}. Ингредиенты не получены!`);
  }

  return data;
};
