import type { TIngredient } from './ingredient';

export type TOrder = {
  id: string;
  number: number;
  name: string;
  status: 'created' | 'pending' | 'done';
  createdAt: string;
  ingredients: string[];
};

export type TOrderSummary = {
  items: { ingredient: TIngredient; quantity: number }[];
  total: number;
};

export type TOrderView = TOrder & { summary: TOrderSummary };
export type TOrderCatalog = Record<string, TIngredient | undefined>;

export type TOrderSnapshot = {
  orders: TOrder[];
  invalidOrderIds: string[];
  total: number;
  totalToday: number;
};

export type TOrderStream = {
  snapshot: TOrderSnapshot | null;
  status: 'connecting' | 'connected' | 'reconnecting' | 'error';
  message: string;
};

// Поколение персональной сессии отделяет её кеш от публичных данных и нового входа.
export type TOrderScope = { kind: 'feed' } | { kind: 'user'; version: number };
