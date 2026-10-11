import type { TIngredient } from './types';

const ingredientsApiUrl =
  'https://new-stellarburgers.education-services.ru/api/ingredients';

type TIngredientsResponse = {
  success: boolean;
  data: TIngredient[];
};

export const getIngredients = async (signal: AbortSignal): Promise<TIngredient[]> => {
  const getIngredientsErrorMessage = 'Ошибка при получении ингредиентов';

  const response = await fetch(ingredientsApiUrl, { signal });

  if (!response.ok) {
    const httpStatus = `${response.status} ${response.statusText}`.trim();

    throw new Error(`${getIngredientsErrorMessage}. HTTP ${httpStatus}`);
  }

  const { success, data } = (await response.json()) as TIngredientsResponse;

  if (!success) {
    throw Error(`${getIngredientsErrorMessage}. Ошибка сервера!`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw Error(`${getIngredientsErrorMessage}. Ингредиенты не получены!`);
  }

  return data;
};
