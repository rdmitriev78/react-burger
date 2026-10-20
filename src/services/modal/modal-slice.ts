import { createSlice } from '@reduxjs/toolkit';

import type { TIngredient } from '@app-types/ingredient';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { TModalState } from '@services/modal/modal-slice.types';

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
  selectors: {
    selectModal: (state): TModalState => state,
  },
});

export const { openIngredientModal, openOrderModal, closeModal } = modalSlice.actions;
export const modalReducer = modalSlice.reducer;
export const { selectModal } = modalSlice.selectors;
