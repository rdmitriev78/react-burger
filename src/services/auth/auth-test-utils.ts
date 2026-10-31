// Независимое хранилище для каждого теста, включая окружения с Node Web Storage.
export const createTestStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length(): number {
      return values.size;
    },
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, String(value));
    },
    removeItem: (key: string): void => {
      values.delete(key);
    },
    clear: (): void => {
      values.clear();
    },
    key: (index: number): string | null => [...values.keys()][index] ?? null,
  };
};
