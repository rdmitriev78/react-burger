import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useAppDispatch } from '@hooks/redux';
import {
  closeRouteModal,
  openErrorModal,
  openFeedOrderModal,
} from '@services/modal/modal-slice';
import { feedOrders } from '@utils/feed-data';

export const FeedOrderModalRoute = (): null => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const order = feedOrders.find((candidate) => candidate.id === id);
    if (order) dispatch(openFeedOrderModal(order));
    else
      dispatch(
        openErrorModal({
          source: 'route',
          title: 'Заказ не найден',
          message: 'Проверьте ссылку или выберите другой заказ в ленте.',
          buttonText: 'Закрыть',
        })
      );

    return (): void => {
      dispatch(closeRouteModal());
    };
  }, [dispatch, id]);

  return null;
};
