import { isObject } from '@services/auth/auth.types';

export const getReturnTo = (state: unknown): string => {
  if (!isObject(state) || !isObject(state.from)) return '/';
  const { pathname, search, hash } = state.from;
  if (
    typeof pathname !== 'string' ||
    typeof search !== 'string' ||
    typeof hash !== 'string'
  )
    return '/';
  if (!/^\/profile(?:\/|$)/.test(pathname) || /[\\?#]/.test(pathname)) return '/';
  if ((search && !search.startsWith('?')) || (hash && !hash.startsWith('#'))) return '/';
  // Проверяем нормализованный путь: /profile/../login не должен создавать цикл.
  const target = new URL(pathname + search + hash, 'https://app.invalid');
  return target.origin === 'https://app.invalid' &&
    /^\/profile(?:\/|$)/.test(target.pathname)
    ? target.pathname + target.search + target.hash
    : '/';
};
