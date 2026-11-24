import { createApi } from '@reduxjs/toolkit/query/react';

import { isAuthResponse, isObject, isUserResponse } from '@services/auth/auth.types';
import { initialOrderStream, parseOrderResponse } from '@services/orders/order-data';
import { runOrderStream } from '@services/orders/order-stream';
import { isPasswordRecoveryResponse } from '@services/password-recovery/password-recovery.types';

import { baseQueryWithReauth } from './base-query-with-reauth';

import type { TIngredient } from '@app-types/ingredient';
import type { TOrder, TOrderScope, TOrderStream } from '@app-types/order';
import type {
  TAuthResponse,
  TCredentials,
  TRegistration,
  TUserResponse,
  TUserUpdate,
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
  // HTTP-запросы получают access-токен и refresh только при явном auth: true.
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    // Потоки начинаются без HTTP: queryFn создаёт состояние, onCacheEntryAdded запускает WS.
    // keepUnusedDataFor: 0 удаляет кеш и завершает поток после ухода последнего подписчика.
    getOrderFeed: builder.query<TOrderStream, void>({
      queryFn: () => ({ data: initialOrderStream() }),
      keepUnusedDataFor: 0,
      onCacheEntryAdded: (_arg, api) => runOrderStream({ kind: 'feed' }, api),
    }),
    // Поколение сессии разделяет персональные кеши; токен читается внутри runOrderStream.
    getUserOrders: builder.query<TOrderStream, number>({
      queryFn: () => ({ data: initialOrderStream() }),
      keepUnusedDataFor: 0,
      onCacheEntryAdded: (version, api) =>
        runOrderStream({ kind: 'user', version }, api),
    }),
    // GET деталей публичный; scope разделяет кеш по ленте/сессии, в URL передаётся только id.
    getOrder: builder.query<TOrder, { id: string; scope: TOrderScope }>({
      extraOptions: { auth: false },
      keepUnusedDataFor: 0,
      queryFn: async ({ id }, _api, _options, baseQuery) => {
        const response = await baseQuery(`orders/${id}`);
        if (response.error) return { error: response.error };
        const order = parseOrderResponse(response.data, id);
        return order
          ? { data: order }
          : {
              error: { status: 'CUSTOM_ERROR', error: 'Некорректные данные заказа' },
            };
      },
    }),
    requestPasswordReset: builder.mutation<
      TPasswordRecoveryResponse,
      TPasswordResetEmailRequest
    >({
      extraOptions: { auth: false },
      query: (body) => ({
        url: 'password-reset',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isPasswordRecoveryResponse(data),
      }),
    }),
    resetPassword: builder.mutation<TPasswordRecoveryResponse, TPasswordResetRequest>({
      extraOptions: { auth: false },
      query: (body) => ({
        url: 'password-reset/reset',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isPasswordRecoveryResponse(data),
      }),
    }),
    login: builder.mutation<TAuthResponse, TCredentials>({
      extraOptions: { auth: false },
      query: (body) => ({
        url: 'auth/login',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isAuthResponse(data),
      }),
    }),
    register: builder.mutation<TAuthResponse, TRegistration>({
      extraOptions: { auth: false },
      query: (body) => ({
        url: 'auth/register',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isAuthResponse(data),
      }),
    }),
    logout: builder.mutation<{ success: true; message: string }, { token: string }>({
      extraOptions: { auth: false },
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
    // Поколение разделяет ожидающие проверки в кеше; серверу оно не передаётся.
    getCurrentUser: builder.query<TUserResponse, number>({
      extraOptions: { auth: true },
      keepUnusedDataFor: 0,
      query: () => ({
        url: 'auth/user',
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isUserResponse(data),
      }),
    }),
    updateCurrentUser: builder.mutation<TUserResponse, TUserUpdate>({
      extraOptions: { auth: true },
      query: (body) => ({
        url: 'auth/user',
        method: 'PATCH',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isUserResponse(data),
      }),
    }),
    createOrder: builder.mutation<TCreateOrderResponse, TCreateOrderRequest>({
      extraOptions: { auth: true },
      query: (body) => ({
        url: 'orders',
        method: 'POST',
        body,
        validateStatus: (response, data: unknown): boolean =>
          response.ok && isCreateOrderResponseValid(data),
      }),
    }),
    getIngredients: builder.query<TIngredient[], void>({
      extraOptions: { auth: false },
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
  useGetOrderFeedQuery,
  useGetUserOrdersQuery,
  useGetOrderQuery,
  useGetIngredientsQuery,
  useLoginMutation,
  useRegisterMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
} = burgerApi;
