import { useCallback } from 'react';

import { useAppDispatch } from '@hooks/redux';
import {
  stopWaiting as stopWaitingThunk,
  submitOrder as submitOrderThunk,
} from '@services/order/order-thunks';

type TOrderSubmission = {
  submitOrder: (ingredientIds: string[]) => Promise<void>;
  stopWaiting: () => void;
};

// Предоставляет компонентам методы общего процесса отправки, которым управляет Redux.
// У хука нет собственного состояния запроса: все его потребители работают с одной отправкой.
export const useOrderSubmission = (): TOrderSubmission => {
  const dispatch = useAppDispatch();

  // dispatch возвращает Promise из thunk; вызывающий компонент может дождаться завершения.
  const submitOrder = useCallback(
    (ingredientIds: string[]): Promise<void> =>
      dispatch(submitOrderThunk(ingredientIds)),
    [dispatch]
  );

  // Прерывание относится к общему запросу, а не к конкретному экземпляру хука.
  const stopWaiting = useCallback((): void => {
    dispatch(stopWaitingThunk());
  }, [dispatch]);

  return { submitOrder, stopWaiting };
};
