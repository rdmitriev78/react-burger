import { CloseIcon } from '@krgaa/react-developer-burger-ui-components';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ModalOverlay } from '@components/modal-overlay/modal-overlay';

import type { ReactNode } from 'react';

import styles from './modal.module.css';

// необходим title или ariaLabel (или оба) для работы скринридера
export type ModalTitleOrAriaLabel =
  | { title: string; ariaLabel?: string }
  | { title?: string; ariaLabel: string };

type TModalProps = {
  children: ReactNode;
  onClose: () => void;
} & ModalTitleOrAriaLabel;

export const Modal = ({
  title,
  ariaLabel,
  children,
  onClose,
}: TModalProps): React.JSX.Element => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const modalRoot = document.getElementById('modal-root');
  const hasTitle = Boolean(title?.trim());
  const hasAriaLabel = Boolean(ariaLabel?.trim());

  // Блокируем переход по Tab с диалога, переводим фокус на кнопку закрытия
  // Если в диалогах появятся интерактивные элементы, то необходимо изменить обработку Tab
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButtonRef.current?.focus();
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
    closeButtonRef.current?.focus();

    return (): void => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert ?? false;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  // Обновляем обработчик Escape при смене onClose, не сбрасывая фокус и блокировку фона.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return (): void => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!modalRoot) {
    throw new Error('Не найден контейнер modal-root');
  }

  if (!hasTitle && !hasAriaLabel) {
    throw new Error('Modal требует указать title или ariaLabel');
  }

  return createPortal(
    <div className={styles.modal_container}>
      <ModalOverlay onClick={onClose} />
      <div
        className={styles.modal}
        role="dialog"
        aria-label={hasAriaLabel ? ariaLabel : undefined}
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-modal="true"
        onKeyDown={handleTabKeyDown}
      >
        <div className="p-10">
          <header className={styles.header}>
            {hasTitle && (
              <h2 id={titleId} className="text text_type_main-large">
                {title}
              </h2>
            )}

            <button
              ref={closeButtonRef}
              className={styles.close}
              type="button"
              aria-label="Закрыть окно"
              onClick={onClose}
            >
              <CloseIcon type="primary" />
            </button>
          </header>

          {children}
        </div>
      </div>
    </div>,
    modalRoot
  );
};
