import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';
import type { TOrderResult, TOrderState } from '@services/order/order-slice.types';
import type { RootState } from '@services/store';

// RTK Query хранит HTTP-запрос, а этот slice — результат процесса оформления для интерфейса.
const orderSlice = createSlice({
  name: 'orderSubmission',
  initialState: (): TOrderState => ({ status: 'idle' }),
  reducers: {
    // Новая отправка заменяет результат предыдущей, сохраняя сам конструктор.
    startOrderSubmission: (): TOrderState => ({ status: 'submitting' }),
    orderSubmissionSucceeded: (
      _state,
      action: PayloadAction<TOrderResult>
    ): TOrderState => ({ status: 'success', orderResult: action.payload }),
    orderSubmissionFailed: (_state, action: PayloadAction<string>): TOrderState => ({
      status: 'error',
      message: action.payload,
    }),
    orderSubmissionStopped: (): TOrderState => ({ status: 'stopped' }),
  },
});

export const {
  startOrderSubmission,
  orderSubmissionSucceeded,
  orderSubmissionFailed,
  orderSubmissionStopped,
} = orderSlice.actions;
export const orderReducer = orderSlice.reducer;
export const selectOrderSubmission = (state: RootState): TOrderState =>
  state.orderSubmission;
export const selectIsOrderSubmitting = (state: RootState): boolean =>
  selectOrderSubmission(state).status === 'submitting';
