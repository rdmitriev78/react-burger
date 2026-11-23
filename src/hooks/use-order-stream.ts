import { useMemo } from 'react';

import {
  useGetIngredientsQuery,
  useGetOrderFeedQuery,
  useGetUserOrdersQuery,
} from '@services/api/burger-api';
import {
  createOrderCatalog,
  initialOrderStream,
  prepareOrder,
} from '@services/orders/order-data';

import type {
  TOrderCatalog,
  TOrderScope,
  TOrderStream,
  TOrderView,
} from '@app-types/order';

const waitingStream = initialOrderStream();

export type TOrderStreamContext = {
  scope: TOrderScope;
  stream: TOrderStream;
  orders: TOrderView[];
  catalog: TOrderCatalog;
  catalogStatus: 'loading' | 'error' | 'ready';
};

/**
 * Объединяет выбранный поток заказов и каталог ингредиентов в общий контекст
 * для ленты, истории и их деталей: подготовленные заказы и состояния загрузки/связи.
 */
export const useOrderStream = (scope: TOrderScope): TOrderStreamContext => {
  // Хуки вызываются без условий; skip включает только подписку выбранной ленты.
  const feed = useGetOrderFeedQuery(undefined, { skip: scope.kind !== 'feed' });
  const user = useGetUserOrdersQuery(scope.kind === 'user' ? scope.version : 0, {
    skip: scope.kind !== 'user',
  });
  const ingredients = useGetIngredientsQuery();
  // currentData не подставляет данные прежнего аргумента при смене пользовательской сессии.
  const stream =
    (scope.kind === 'feed' ? feed.currentData : user.currentData) ?? waitingStream;
  const catalog = useMemo(
    () => createOrderCatalog(ingredients.data ?? []),
    [ingredients.data]
  );
  // По серверному каталогу готовим состав и сумму, пропуская непригодные заказы.
  // Порядок оставшихся заказов сохраняется таким, каким пришёл в снимке.
  const orders = useMemo(
    () =>
      stream.snapshot?.orders.flatMap((order) => {
        const prepared = prepareOrder(order, catalog);
        return prepared ? [prepared] : [];
      }) ?? [],
    [stream.snapshot, catalog]
  );
  return {
    scope,
    stream,
    orders,
    catalog,
    catalogStatus: ingredients.isError
      ? 'error'
      : ingredients.data
        ? 'ready'
        : 'loading',
  };
};
