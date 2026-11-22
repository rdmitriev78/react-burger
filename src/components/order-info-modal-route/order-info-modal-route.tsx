import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useAppDispatch } from '@hooks/redux';
import {
  closeRouteModal,
  openErrorModal,
  openOrderInfoModal,
} from '@services/modal/modal-slice';

import type { TOrder } from '@app-types/order';

type TOrderInfoModalRouteProps = {
  orders: readonly TOrder[];
  notFoundMessage: string;
};

export const OrderInfoModalRoute = ({
  orders,
  notFoundMessage,
}: TOrderInfoModalRouteProps): null => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const order = orders.find((candidate) => candidate.id === id);
    if (order) dispatch(openOrderInfoModal(order));
    else
      dispatch(
        openErrorModal({
          source: 'route',
          title: 'Заказ не найден',
          message: notFoundMessage,
          buttonText: 'Закрыть',
        })
      );

    return (): void => {
      dispatch(closeRouteModal());
    };
  }, [dispatch, id, notFoundMessage, orders]);

  return null;
};
