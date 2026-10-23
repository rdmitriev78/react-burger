import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';
import type { TOrderResult, TOrderState } from '@services/order/order-slice.types';

// RTK Query хранит HTTP-запрос, а этот slice — результат процесса оформления для интерфейса.
export const orderSlice = createSlice({
  // name задаёт префикс типов actions, например orderSubmission/startOrderSubmission.
  // reducerPath по умолчанию равен name: combineSlices и selectors используют этот ключ.
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
  selectors: {
    selectOrderSubmission: (state): TOrderState => state,
    selectIsOrderSubmitting: (state): boolean => state.status === 'submitting',
  },
});

export const {
  startOrderSubmission,
  orderSubmissionSucceeded,
  orderSubmissionFailed,
  orderSubmissionStopped,
} = orderSlice.actions;
export const { selectOrderSubmission, selectIsOrderSubmitting } = orderSlice.selectors;
