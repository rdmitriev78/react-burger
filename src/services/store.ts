import { configureStore } from '@reduxjs/toolkit';

import { burgerApi } from './api/burger-api';
import { constructorReducer } from './constructor/constructor-slice';
import { modalReducer } from './modal/modal-slice';

export const store = configureStore({
  reducer: {
    [burgerApi.reducerPath]: burgerApi.reducer,
    burgerConstructor: constructorReducer,
    modal: modalReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(burgerApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
