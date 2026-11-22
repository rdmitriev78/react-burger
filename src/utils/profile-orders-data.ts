import { feedOrders } from '@utils/feed-data';

import type { TOrder } from '@app-types/order';

// Отдельные примеры истории: изменение статуса не затрагивает публичную ленту.
export const profileOrders: TOrder[] = feedOrders.map((order) => ({
  ...order,
  status: order.id === '34534' ? 'pending' : order.status,
}));
