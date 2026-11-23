import { isObject } from '@services/auth/auth.types';
import { getOrderSummary } from '@utils/order';

import type { TIngredient } from '@app-types/ingredient';
import type {
  TOrder,
  TOrderCatalog,
  TOrderSnapshot,
  TOrderStream,
  TOrderView,
} from '@app-types/order';

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export const isOrderId = (id: string): boolean => /^[a-f\d]{24}$/i.test(id);

// Проверяем внешние данные и приводим заказ к модели интерфейса; пустое имя заменяем на «Бургер».
export const parseOrder = (value: unknown): TOrder | undefined => {
  if (
    !isObject(value) ||
    !nonEmpty(value._id) ||
    !count(value.number) ||
    !nonEmpty(value.createdAt) ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    (value.status !== 'created' &&
      value.status !== 'pending' &&
      value.status !== 'done') ||
    !Array.isArray(value.ingredients) ||
    value.ingredients.length === 0 ||
    !value.ingredients.every(nonEmpty) ||
    (value.name != null && typeof value.name !== 'string')
  )
    return undefined;

  return {
    id: value._id,
    number: value.number,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Бургер',
    status: value.status,
    createdAt: value.createdAt,
    ingredients: value.ingredients,
  };
};

export const parseOrderSnapshot = (value: unknown): TOrderSnapshot | undefined => {
  if (
    !isObject(value) ||
    value.success !== true ||
    !Array.isArray(value.orders) ||
    !count(value.total) ||
    !count(value.totalToday)
  )
    return undefined;

  // Повреждённые заказы пропускаем, сохраняя порядок остальных и ID отклонённых:
  // детали должны показать ошибку данных, а не запрашивать присутствующий в снимке заказ через GET.
  const orders: TOrder[] = [];
  const invalidOrderIds: string[] = [];
  for (const candidate of value.orders) {
    const order = parseOrder(candidate);
    if (order) orders.push(order);
    else if (isObject(candidate) && nonEmpty(candidate._id))
      invalidOrderIds.push(candidate._id);
  }
  return { orders, invalidOrderIds, total: value.total, totalToday: value.totalToday };
};

// GET должен вернуть именно запрошенный заказ, а не только корректную по форме запись.
export const parseOrderResponse = (value: unknown, id: string): TOrder | undefined => {
  if (!isObject(value) || value.success !== true) return undefined;
  const order = parseOrder(value.order);
  return order?.id === id ? order : undefined;
};

// Индексируем по ID ингредиенты с пригодными для состава полями и ценой.
export const createOrderCatalog = (ingredients: readonly TIngredient[]): TOrderCatalog =>
  Object.fromEntries(
    ingredients
      .filter(
        (ingredient: unknown): ingredient is TIngredient =>
          isObject(ingredient) &&
          nonEmpty(ingredient._id) &&
          nonEmpty(ingredient.name) &&
          nonEmpty(ingredient.image_mobile) &&
          typeof ingredient.price === 'number' &&
          Number.isFinite(ingredient.price) &&
          ingredient.price >= 0
      )
      .map((ingredient) => [ingredient._id, ingredient])
  );

// Карточка и детали получают общий состав/итог; неполный состав не отображаем с заниженной суммой.
export const prepareOrder = (
  order: TOrder,
  catalog: TOrderCatalog
): TOrderView | undefined => {
  const summary = getOrderSummary(order, catalog);
  return summary ? { ...order, summary } : undefined;
};

export const initialOrderStream = (): TOrderStream => ({
  snapshot: null,
  status: 'connecting',
  message: '',
});
