import { CloseIcon } from '@krgaa/react-developer-burger-ui-components';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ModalOverlay } from '@components/modal-overlay/modal-overlay';

import type { ReactNode } from 'react';

import styles from './modal.module.css';

// Необходим title или ariaLabel (или оба) для работы скринридера.
type TModalTitleOrAriaLabel =
  | { title: string; ariaLabel?: string }
  | { title?: string; ariaLabel: string };

type TModalProps = {
  children: ReactNode;
  onClose: () => void;
  canClose?: boolean;
} & TModalTitleOrAriaLabel;

export const Modal = ({
  title,
  ariaLabel,
  children,
  onClose,
  canClose = true,
}: TModalProps): React.JSX.Element => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const modalRoot = document.getElementById('modal-root');
  const hasTitle = Boolean(title?.trim());
  const hasAriaLabel = Boolean(ariaLabel?.trim());

  // Удерживаем фокус внутри диалога, учитывая появление и удаление кнопок.
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), ' +
          'select:not([disabled]), textarea:not([disabled]), ' +
          '[tabindex]:not([tabindex="-1"])'
      )
    ).filter(
      (element) =>
        !element.closest('[hidden], [inert]') && element.getClientRects().length > 0
    );
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
    } else if (
      !focusableElements.some((element) => element === activeElement) ||
      (event.shiftKey && activeElement === first) ||
      (!event.shiftKey && activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  // Блокируем фон и управляем фокусом только при открытии и закрытии модалки.
  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert;

    document.body.style.overflow = 'hidden';
    if (appRoot) appRoot.inert = true;
    (closeButtonRef.current ?? dialogRef.current)?.focus();

    return (): void => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert ?? false;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (canClose) closeButtonRef.current?.focus();
  }, [canClose]);

  // Обновляем обработчик Escape при смене onClose, не сбрасывая фокус и блокировку фона.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && canClose) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return (): void => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [canClose, onClose]);

  if (!modalRoot) {
    throw new Error('Не найден контейнер modal-root');
  }

  if (!hasTitle && !hasAriaLabel) {
    throw new Error('Modal требует указать title или ariaLabel');
  }

  return createPortal(
    <div className={styles.modal_container}>
      <ModalOverlay
        onClick={() => {
          if (canClose) onClose();
        }}
      />
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-label={hasAriaLabel ? ariaLabel : undefined}
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={handleTabKeyDown}
      >
        <div className="p-10">
          {(hasTitle || canClose) && (
            <header className={styles.header}>
              {hasTitle && (
                <h2 id={titleId} className="text text_type_main-large">
                  {title}
                </h2>
              )}

              {canClose && (
                <button
                  ref={closeButtonRef}
                  className={styles.close}
                  type="button"
                  aria-label="Закрыть окно"
                  onClick={onClose}
                >
                  <CloseIcon type="primary" />
                </button>
              )}
            </header>
          )}

          {children}
        </div>
      </div>
    </div>,
    modalRoot
  );
};
