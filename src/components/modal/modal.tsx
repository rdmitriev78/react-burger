import { CloseIcon } from '@krgaa/react-developer-burger-ui-components';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const modalRoot = document.getElementById('modal-root');
  const hasTitle = Boolean(title?.trim());
  const hasAriaLabel = Boolean(ariaLabel?.trim());

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;

    dialog?.showModal();
    document.body.style.overflow = 'hidden';

    return (): void => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!modalRoot) {
    throw new Error('Не найден контейнер modal-root');
  }

  if (!hasTitle && !hasAriaLabel) {
    throw new Error('Modal требует непустой title или ariaLabel');
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-label={hasAriaLabel ? ariaLabel : undefined}
      aria-labelledby={hasTitle ? titleId : undefined}
      aria-modal="true"
      onCancel={(event): void => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event): void => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="p-10">
        <header className={styles.header}>
          {hasTitle && (
            <h2 id={titleId} className="text text_type_main-large">
              {title}
            </h2>
          )}

          <button
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
    </dialog>,
    modalRoot
  );
};
