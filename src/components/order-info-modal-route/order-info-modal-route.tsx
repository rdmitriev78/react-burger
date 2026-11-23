import { useEffect, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';

import { useAppDispatch } from '@hooks/redux';
import { useGetOrderQuery } from '@services/api/burger-api';
import { closeRouteModal, openOrderInfoModal } from '@services/modal/modal-slice';
import { isOrderId, prepareOrder } from '@services/orders/order-data';

import type { TOrderStreamContext } from '@hooks/use-order-stream';
import type { TOrderInfoView } from '@services/modal/modal-slice.types';

export const OrderInfoModalRoute = (): null => {
  const { id = '' } = useParams<{ id: string }>();
  const context = useOutletContext<TOrderStreamContext>();
  const dispatch = useAppDispatch();
  const { scope, stream, catalog, catalogStatus } = context;
  const streamed = stream.snapshot?.orders.find((order) => order.id === id);
  const invalid = stream.snapshot?.invalidOrderIds.includes(id) === true;
  const query = useGetOrderQuery(
    { id, scope },
    {
      skip: !isOrderId(id) || !stream.snapshot || !!streamed || invalid,
    }
  );
  const view = useMemo((): TOrderInfoView => {
    if (!isOrderId(id))
      return {
        status: 'error',
        title: 'Заказ не найден',
        message: 'Проверьте ссылку или выберите другой заказ.',
        retry: null,
      };
    if (catalogStatus === 'error')
      return {
        status: 'error',
        title: 'Не удалось загрузить ингредиенты',
        message: 'Повторите загрузку каталога.',
        retry: 'catalog',
      };
    if (!stream.snapshot)
      return stream.message
        ? {
            status: 'error',
            title: 'Не удалось загрузить заказы',
            message: stream.message,
            retry: 'stream',
          }
        : { status: 'loading', message: 'Загружаем заказ…' };
    if (invalid)
      return {
        status: 'error',
        title: 'Некорректные данные заказа',
        message: 'Этот заказ невозможно отобразить.',
        retry: null,
      };
    if (catalogStatus === 'loading')
      return { status: 'loading', message: 'Загружаем ингредиенты…' };
    // Поток всегда приоритетнее ответа уже запущенного GET.
    const order = streamed ?? query.currentData;
    if (order) {
      const prepared = prepareOrder(order, catalog);
      return prepared
        ? { status: 'ready', order: prepared }
        : {
            status: 'error',
            title: 'Некорректные данные заказа',
            message: 'Состав заказа недоступен в каталоге.',
            retry: null,
          };
    }
    if (query.isError)
      return 'status' in query.error && query.error.status === 404
        ? {
            status: 'error',
            title: 'Заказ не найден',
            message: 'Проверьте ссылку или выберите другой заказ.',
            retry: null,
          }
        : {
            status: 'error',
            title: 'Не удалось загрузить заказ',
            message: 'Повторите попытку загрузки.',
            retry: 'order',
          };
    return { status: 'loading', message: 'Загружаем заказ…' };
  }, [
    id,
    stream,
    catalogStatus,
    invalid,
    streamed,
    query.currentData,
    query.isError,
    query.error,
    catalog,
  ]);

  useEffect(() => {
    dispatch(openOrderInfoModal({ id, scope, view }));
  }, [dispatch, id, scope, view]);
  // Cleanup относится к уходу с маршрута, а не к каждому новому снимку.
  useEffect(
    () => (): void => {
      dispatch(closeRouteModal());
    },
    [dispatch]
  );
  return null;
};
