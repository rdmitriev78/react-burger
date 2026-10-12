import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ingredients } from '@utils/ingredients';

import type { TIngredient } from '@app-types/ingredient';

type TIngredientsResponse = {
  success: boolean;
  data: TIngredient[];
};

const BURGER_API_BASE_URL = 'https://new-stellarburgers.education-services.ru/api/';
// Temporary API simulation. Set to false to restore server requests.
const USE_LOCAL_INGREDIENTS = true;

export const burgerApi = createApi({
  reducerPath: 'burgerApi',
  baseQuery: fetchBaseQuery({
    baseUrl: BURGER_API_BASE_URL,
    fetchFn: async (input, init): Promise<Response> => {
      const request = input instanceof Request ? input : new Request(input, init);

      if (
        USE_LOCAL_INGREDIENTS &&
        request.method === 'GET' &&
        request.url === `${BURGER_API_BASE_URL}ingredients`
      ) {
        request.signal.throwIfAborted();
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        });
        request.signal.throwIfAborted();

        const response: TIngredientsResponse = {
          success: true,
          data: ingredients,
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return fetch(input, init);
    },
  }),
  endpoints: (builder) => ({
    getIngredients: builder.query<TIngredient[], void>({
      query: () => ({
        url: 'ingredients',
        validateStatus: (response, body: unknown): boolean =>
          response.ok &&
          typeof body === 'object' &&
          body !== null &&
          'success' in body &&
          body.success === true &&
          'data' in body &&
          Array.isArray(body.data) &&
          body.data.length > 0,
      }),
      transformResponse: (response: TIngredientsResponse): TIngredient[] =>
        response.data,
    }),
  }),
});

export const { useGetIngredientsQuery } = burgerApi;
