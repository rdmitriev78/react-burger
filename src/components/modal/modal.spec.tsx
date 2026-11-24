import { cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

describe('фокус при обновлении Modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div><div id="modal-root"></div>';
  });
  afterEach(cleanup);

  it.each([true, false])(
    'возвращает потерянный фокус внутрь окна, canClose=%s',
    (canClose) => {
      const content = (loading: boolean): React.JSX.Element => (
        <StrictMode>
          <Modal title="Детали" onClose={vi.fn()} canClose={canClose}>
            {loading ? <p>Загружаем…</p> : <button>Повторить</button>}
          </Modal>
        </StrictMode>
      );
      const { rerender } = render(content(false));
      const dialog = screen.getByRole('dialog');
      screen.getByRole('button', { name: 'Повторить' }).focus();
      rerender(content(true));
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(
        canClose ? screen.getByRole('button', { name: 'Закрыть окно' }) : dialog
      ).toHaveFocus();
      expect(document.getElementById('root')?.inert).toBe(true);
    }
  );

  it('сохраняет фокус на оставшемся элементе при обновлении содержимого', () => {
    const content = (status: string): React.JSX.Element => (
      <Modal title="Детали" onClose={vi.fn()}>
        <button>Действие</button>
        <p>{status}</p>
      </Modal>
    );
    const { rerender } = render(content('Готовится'));
    const action = screen.getByRole('button', { name: 'Действие' });
    action.focus();
    rerender(content('Выполнен'));
    expect(action).toHaveFocus();
  });
});
