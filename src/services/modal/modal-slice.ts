import { createSlice } from '@reduxjs/toolkit';

import type { TIngredient } from '@app-types/ingredient';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { TErrorModalState, TModalState } from '@services/modal/modal-slice.types';

export const modalSlice = createSlice({
  // name задаёт префикс типов actions, например modal/closeModal.
  // reducerPath по умолчанию равен name: combineSlices и selectors используют этот ключ.
  name: 'modal',
  initialState: (): TModalState => ({ type: 'closed' }),
  reducers: {
    openIngredientModal: (_state, action: PayloadAction<TIngredient>): TModalState => ({
      type: 'ingredient',
      source: 'route',
      ingredient: action.payload,
    }),
    openOrderModal: (): TModalState => ({
      type: 'order',
      source: 'application',
    }),
    openErrorModal: (
      _state,
      action: PayloadAction<Omit<TErrorModalState, 'type'>>
    ): TModalState => ({ type: 'error', ...action.payload }),
    // Очищает текущее окно с source === 'route' при уходе с маршрута.
    // Окна с source === 'application' не затрагивает.
    // Пользовательское закрытие маршрутного окна сначала запускает навигацию;
    // это действие вызывается из cleanup компонента маршрута.
    closeRouteModal: (state): TModalState | undefined => {
      if (state.type !== 'closed' && state.source === 'route') {
        return { type: 'closed' };
      }
    },
    closeModal: (): TModalState => ({ type: 'closed' }),
  },
  selectors: {
    selectModal: (state): TModalState => state,
  },
});

export const {
  openIngredientModal,
  openOrderModal,
  openErrorModal,
  closeRouteModal,
  closeModal,
} = modalSlice.actions;
export const { selectModal } = modalSlice.selectors;
