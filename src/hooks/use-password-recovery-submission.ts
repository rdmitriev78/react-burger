import { useEffect, useRef, useState } from 'react';

import { passwordRecoveryStorageErrorMessage } from '@services/password-recovery/password-recovery-storage';

import type { TPasswordRecoveryResponse } from '@services/password-recovery/password-recovery.types';

type TRecoveryRequest = {
  abort: () => void;
  unwrap: () => Promise<TPasswordRecoveryResponse>;
};

export const usePasswordRecoverySubmission = <T>(
  request: (values: T) => TRecoveryRequest,
  complete: () => void,
  requestErrorMessage: string
): {
  submit: (values: T) => Promise<void>;
  error: string;
  isSubmitting: boolean;
  isConfirmed: boolean;
} => {
  // Проверяем, что страница ещё смонтирована, перед обработкой результата запроса.
  const mountedRef = useRef(true);
  // Блокируем повторный submit сразу, не дожидаясь следующего рендера.
  const pendingRef = useRef(false);
  // Запоминаем успех API, чтобы при ошибке хранилища не повторять HTTP-запрос.
  const confirmedRef = useRef(false);
  // Храним активную мутацию, чтобы отменить её при размонтировании страницы.
  const requestRef = useRef<TRecoveryRequest | null>(null);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const submit = async (values: T): Promise<void> => {
    if (pendingRef.current || !mountedRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      // После успешного ответа API повторяем только запись/очистку флага:
      // код сброса уже мог быть использован, а письмо уже отправлено.
      if (!confirmedRef.current) {
        const operation = request(values);
        requestRef.current = operation;
        await operation.unwrap();
        if (!mountedRef.current) return;
        confirmedRef.current = true;
        setIsConfirmed(true);
      }
      try {
        complete();
      } catch {
        setError(passwordRecoveryStorageErrorMessage);
      }
    } catch {
      if (mountedRef.current) setError(requestErrorMessage);
    } finally {
      requestRef.current = null;
      pendingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  return { submit, error, isSubmitting, isConfirmed };
};
