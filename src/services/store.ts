import {
  combineSlices,
  configureStore,
  createListenerMiddleware,
} from '@reduxjs/toolkit';

import { burgerApi } from './api/burger-api';
import { authSlice } from './auth/auth-slice';
import { constructorSlice } from './constructor/constructor-slice';
import { modalSlice } from './modal/modal-slice';
import { orderSlice } from './order/order-slice';

import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';

// combineSlices берёт reducer и reducerPath из каждого слайса и RTK Query API.
export const rootReducer = combineSlices(
  burgerApi,
  authSlice,
  constructorSlice,
  modalSlice,
  orderSlice
);

export type RootState = ReturnType<typeof rootReducer>;

export const store = configureStore({
  reducer: rootReducer,
  // Сохраняем стандартные middleware: thunk и проверки действий/состояния при разработке.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      // Слушатели повтора потока и смены сессии идут до проверки сериализуемости:
      // действия их регистрации содержат функции.
      .prepend(createListenerMiddleware().middleware)
      // RTK Query обслуживает запросы, подписки и жизненный цикл кеша.
      .concat(burgerApi.middleware),
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
