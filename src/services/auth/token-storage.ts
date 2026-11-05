import type { TTokens } from './auth.types';

export const storageErrorMessage =
  'Не удалось прочитать или сохранить сессию. Проверьте настройки браузера и повторите попытку.';

export const clearTokens = (): void => {
  // Пробуем удалить оба ключа, даже если удаление одного завершилось ошибкой.
  try {
    localStorage.removeItem('accessToken');
  } finally {
    localStorage.removeItem('refreshToken');
  }
};

export const readTokens = (): TTokens | null => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (accessToken?.trim() && refreshToken?.trim()) return { accessToken, refreshToken };
  if (accessToken !== null || refreshToken !== null) clearTokens();
  return null;
};

export const saveTokens = ({ accessToken, refreshToken }: TTokens): void => {
  try {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  } catch {
    try {
      clearTokens();
    } catch {
      /* Хранилище может запрещать и запись, и удаление. */
    }
    throw new Error(storageErrorMessage);
  }
};
