import { createSlice } from '@reduxjs/toolkit';

import type { TIngredient } from '@app-types/ingredient';
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
    openOrderModal: (): TModalState => ({
      type: 'order',
    }),
    closeModal: (): TModalState => ({ type: 'closed' }),
  },
});

export const { openIngredientModal, openOrderModal, closeModal } = modalSlice.actions;
export const modalReducer = modalSlice.reducer;
export const selectModal = (state: RootState): TModalState => state.modal;
