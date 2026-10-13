import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ingredients } from '@utils/ingredients';

import type { TIngredient } from '@app-types/ingredient';

type TIngredientsResponse = {
  success: boolean;
  data: TIngredient[];
};

const burgerApiBaseUrl = 'https://new-stellarburgers.education-services.ru/api/';
// Симуляция API. true - локальные данные. false - сетевые данные.
const useLocalIngredients = true;

export const burgerApi = createApi({
  reducerPath: 'burgerApi',
  baseQuery: fetchBaseQuery({
    baseUrl: burgerApiBaseUrl,
    fetchFn: async (input, init): Promise<Response> => {
      const request = input instanceof Request ? input : new Request(input, init);

      if (
        useLocalIngredients &&
        request.method === 'GET' &&
        request.url === `${burgerApiBaseUrl}ingredients`
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
