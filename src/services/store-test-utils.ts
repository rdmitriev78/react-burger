import { configureStore } from '@reduxjs/toolkit';

import { burgerApi } from './api/burger-api';
import { rootReducer } from './store';

import type { AppStore } from './store';

// Отдельный store для каждого теста; конфигурация повторяет основной store.
export const createTestStore = (): AppStore =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(burgerApi.middleware),
  });
