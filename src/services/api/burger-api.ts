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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Проверяем только оболочку ответа и наличие ингредиентов.
// Поля элементов data не проверяем: доверяем учебному API.
const isGetIngredientsResponseValid = (body: unknown): body is TIngredientsResponse =>
  isObject(body) &&
  body.success === true &&
  Array.isArray(body.data) &&
  body.data.length > 0;

const isCreateOrderResponseValid = (body: unknown): body is TCreateOrderResponse =>
  isObject(body) &&
  body.success === true &&
  typeof body.name === 'string' &&
  body.name.trim().length > 0 &&
  isObject(body.order) &&
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
