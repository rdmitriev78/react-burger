import { useMemo } from 'react';

import type { TConstructorState, TIngredientCounts } from '@utils/types';

export const useIngredientCounts = (
  constructorState: TConstructorState | null
): TIngredientCounts =>
  useMemo(() => {
    const counts = new Map<string, number>();

    if (constructorState) {
      counts.set(constructorState.bun._id, 2);

      for (const { ingredient } of constructorState.ingredients) {
        counts.set(ingredient._id, (counts.get(ingredient._id) ?? 0) + 1);
      }
    }

    return counts;
  }, [constructorState]);
