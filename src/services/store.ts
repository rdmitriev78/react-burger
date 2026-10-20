import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { burgerApi } from './api/burger-api';
import { constructorSlice } from './constructor/constructor-slice';
import { modalSlice } from './modal/modal-slice';
import { orderSlice } from './order/order-slice';

import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';

// combineSlices берёт reducer и reducerPath из каждого слайса и RTK Query API.
const rootReducer = combineSlices(burgerApi, constructorSlice, modalSlice, orderSlice);

export type RootState = ReturnType<typeof rootReducer>;

export const store = configureStore({
  reducer: rootReducer,
  // Подключение API к редьюсеру не добавляет middleware для запросов и кеша.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(burgerApi.middleware),
});

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
