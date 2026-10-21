import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { TIngredient } from '@app-types/ingredient';

type TCreateOrderRequest = {
  ingredients: string[];
};

type TCreateOrderResponse = {
  name: string;
  order: { number: number };
  success: true;
};

type TIngredientsResponse = {
  success: boolean;
  data: TIngredient[];
};

const burgerApiBaseUrl = 'https://new-stellarburgers.education-services.ru/api/';

// Проверяем только оболочку ответа и наличие ингредиентов.
// Поля элементов data не проверяем: доверяем учебному API.
const isGetIngredientsResponseValid = (body: unknown): body is TIngredientsResponse =>
  typeof body === 'object' &&
  body !== null &&
  'success' in body &&
  body.success === true &&
  'data' in body &&
  Array.isArray(body.data) &&
  body.data.length > 0;

const isCreateOrderResponseValid = (body: unknown): body is TCreateOrderResponse =>
  typeof body === 'object' &&
  body !== null &&
  'success' in body &&
  body.success === true &&
  'name' in body &&
  typeof body.name === 'string' &&
  body.name.trim().length > 0 &&
  'order' in body &&
  typeof body.order === 'object' &&
  body.order !== null &&
  'number' in body.order &&
  typeof body.order.number === 'number' &&
  Number.isSafeInteger(body.order.number) &&
  body.order.number > 0;

export const burgerApi = createApi({
  reducerPath: 'burgerApi',
  baseQuery: fetchBaseQuery({
    baseUrl: burgerApiBaseUrl,
  }),
  endpoints: (builder) => ({
    createOrder: builder.mutation<TCreateOrderResponse, TCreateOrderRequest>({
      query: (body) => ({
        url: 'orders',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isCreateOrderResponseValid(data),
      }),
    }),
    getIngredients: builder.query<TIngredient[], void>({
      query: () => ({
        url: 'ingredients',
        validateStatus: (response, body: unknown): boolean =>
          response.ok && isGetIngredientsResponseValid(body),
      }),
      transformResponse: (response: TIngredientsResponse): TIngredient[] =>
        response.data,
    }),
  }),
});

export const { useGetIngredientsQuery } = burgerApi;
