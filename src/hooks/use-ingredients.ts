import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_INGREDIENT_ERROR, getIngredients } from '@utils/ingredient-api';

import type { TIngredient } from '@utils/types';

type TRequestState =
  | { status: 'loading' }
  | { status: 'success'; ingredients: TIngredient[] }
  | { status: 'error'; message: string };

export const useIngredients = (): {
  requestState: TRequestState;
  retry: () => void;
} => {
  const [requestState, setRequestState] = useState<TRequestState>({
    status: 'loading',
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadIngredients = useCallback(async (): Promise<void> => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRequestState({ status: 'loading' });

    try {
      const ingredients = await getIngredients(controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      setRequestState({ status: 'success', ingredients });
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      console.error(error);
      setRequestState({
        status: 'error',
        message: error instanceof Error ? error.message : DEFAULT_INGREDIENT_ERROR,
      });
    }
  }, []);

  const retry = useCallback((): void => {
    void loadIngredients();
  }, [loadIngredients]);

  useEffect(() => {
    void loadIngredients();

    return (): void => {
      abortControllerRef.current?.abort();
    };
  }, [loadIngredients]);

  return { requestState, retry };
};
