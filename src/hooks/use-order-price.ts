import { useMemo } from 'react';

import type { TConstructorState } from '@utils/types';

export const useOrderPrice = (constructorState: TConstructorState | null): number =>
  useMemo(() => {
    if (!constructorState) return 0;

    return constructorState.ingredients.reduce(
      (total, { ingredient }) => total + ingredient.price,
      constructorState.bun.price * 2
    );
  }, [constructorState]);
