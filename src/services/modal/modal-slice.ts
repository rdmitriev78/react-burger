import { createSlice } from '@reduxjs/toolkit';

import type { TIngredient } from '@app-types/ingredient';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { TModalState } from '@services/modal/modal-slice.types';

export const modalSlice = createSlice({
  // name задаёт префикс типов actions, например modal/closeModal.
  // reducerPath по умолчанию равен name: combineSlices и selectors используют этот ключ.
  name: 'modal',
  initialState: (): TModalState => ({ type: 'closed' }),
  reducers: {
    openIngredientModal: (_state, action: PayloadAction<TIngredient>): TModalState => ({
      type: 'ingredient',
      ingredient: action.payload,
    }),
    openOrderModal: (): TModalState => ({
      type: 'order',
    }),
    closeModal: (): TModalState => ({ type: 'closed' }),
  },
  selectors: {
    selectModal: (state): TModalState => state,
  },
});

export const { openIngredientModal, openOrderModal, closeModal } = modalSlice.actions;
export const { selectModal } = modalSlice.selectors;
