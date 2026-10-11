import { useMemo } from 'react';

import type { TConstructorState } from '@utils/types';

export const useOrderPrice = (constructorState: TConstructorState): number =>
  useMemo(() => {
    const startPrice = constructorState.bun ? constructorState.bun.price * 2 : 0;

    return constructorState.ingredients.reduce(
      (total, { ingredient }) => total + ingredient.price,
      startPrice
    );
  }, [constructorState]);
