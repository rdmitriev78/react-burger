import type { TOrder, TOrderCatalog, TOrderSummary } from '@app-types/order';

export const getOrderSummary = (
  order: TOrder,
  catalog: TOrderCatalog
): TOrderSummary | undefined => {
  const grouped = new Map<string, TOrderSummary['items'][number]>();
  let total = 0;

  // Неизвестный ингредиент делает весь итог недостоверным: частичную сумму не показываем.
  for (const id of order.ingredients) {
    const ingredient = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
    if (!ingredient) return undefined;
    const existing = grouped.get(id);
    if (existing) existing.quantity += 1;
    else grouped.set(id, { ingredient, quantity: 1 });
    total += ingredient.price;
  }

  return { items: [...grouped.values()], total };
};

export const formatOrderNumber = (number: number): string =>
  number.toString().padStart(6, '0');
