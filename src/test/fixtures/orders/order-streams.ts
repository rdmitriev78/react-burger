import { createdOrder, longOrder, repeatedOrder } from './orders';

export const publicSnapshot = {
  success: true,
  orders: [createdOrder, longOrder, repeatedOrder],
  total: 28752,
  totalToday: 138,
};
export const personalSnapshot = {
  success: true,
  orders: [longOrder, repeatedOrder],
  total: 2,
  totalToday: 1,
};
