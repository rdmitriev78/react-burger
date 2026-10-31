import { createApi } from '@reduxjs/toolkit/query/react';

import { isAuthResponse, isObject, isUserResponse } from '@services/auth/auth.types';
import { isPasswordRecoveryResponse } from '@services/password-recovery/password-recovery.types';

import { createBaseQueryWithReauth } from './base-query-with-reauth';

import type { TIngredient } from '@app-types/ingredient';
import type {
  TAuthResponse,
  TCredentials,
  TRegistration,
  TUserResponse,
} from '@services/auth/auth.types';
import type {
  TPasswordRecoveryResponse,
  TPasswordResetEmailRequest,
  TPasswordResetRequest,
} from '@services/password-recovery/password-recovery.types';

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
  baseQuery: createBaseQueryWithReauth(),
  endpoints: (builder) => ({
    requestPasswordReset: builder.mutation<
      TPasswordRecoveryResponse,
      TPasswordResetEmailRequest
    >({
      query: (body) => ({
        url: 'password-reset',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isPasswordRecoveryResponse(data),
      }),
    }),
    resetPassword: builder.mutation<TPasswordRecoveryResponse, TPasswordResetRequest>({
      query: (body) => ({
        url: 'password-reset/reset',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isPasswordRecoveryResponse(data),
      }),
    }),
    login: builder.mutation<TAuthResponse, TCredentials>({
      query: (body) => ({
        url: 'auth/login',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isAuthResponse(data),
      }),
    }),
    register: builder.mutation<TAuthResponse, TRegistration>({
      query: (body) => ({
        url: 'auth/register',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isAuthResponse(data),
      }),
    }),
    logout: builder.mutation<{ success: true; message: string }, { token: string }>({
      query: (body) => ({
        url: 'auth/logout',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok &&
          isObject(data) &&
          data.success === true &&
          typeof data.message === 'string',
      }),
    }),
    getCurrentUser: builder.query<TUserResponse, void>({
      keepUnusedDataFor: 0,
      query: () => ({
        url: 'auth/user',
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isUserResponse(data),
      }),
    }),
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

export const {
  useGetIngredientsQuery,
  useLoginMutation,
  useRegisterMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
} = burgerApi;
