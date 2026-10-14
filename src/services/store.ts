import { configureStore } from '@reduxjs/toolkit';

import { burgerApi } from './api/burger-api';
import { constructorReducer } from './constructor/constructor-slice';
import { modalReducer } from './modal/modal-slice';
import { orderReducer } from './order/order-slice';

import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {
    [burgerApi.reducerPath]: burgerApi.reducer,
    burgerConstructor: constructorReducer,
    modal: modalReducer,
    orderSubmission: orderReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(burgerApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

// Тип thunk с состоянием нашего store. TResult задаёт результат dispatch:
// например, Promise<void> для отправки заказа или void для прерывания ожидания.
export type AppThunk<TResult = void> = ThunkAction<
  TResult,
  RootState,
  unknown,
  UnknownAction
>;
