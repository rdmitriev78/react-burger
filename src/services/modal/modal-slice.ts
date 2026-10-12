import { createSlice } from '@reduxjs/toolkit';

import type { TIngredient } from '@app-types/ingredient';
import type { TOrder } from '@app-types/order';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { TModalState } from '@services/modal/modal-slice.types';
import type { RootState } from '@services/store';

const modalSlice = createSlice({
  name: 'modal',
  initialState: (): TModalState => ({ type: 'closed' }),
  reducers: {
    openIngredientModal: (_state, action: PayloadAction<TIngredient>): TModalState => ({
      type: 'ingredient',
      ingredient: action.payload,
    }),
    openOrderModal: (_state, action: PayloadAction<TOrder>): TModalState => ({
      type: 'order',
      order: action.payload,
    }),
    closeModal: (): TModalState => ({ type: 'closed' }),
  },
});

export const { openIngredientModal, openOrderModal, closeModal } = modalSlice.actions;
export const modalReducer = modalSlice.reducer;
export const selectModal = (state: RootState): TModalState => state.modal;
