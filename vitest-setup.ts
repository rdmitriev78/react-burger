// API-тесты работают в Node, компонентные — в jsdom.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

export {};
