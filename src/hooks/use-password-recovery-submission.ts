import { useEffect, useRef, useState } from 'react';

import { passwordRecoveryStorageErrorMessage } from '@services/password-recovery/password-recovery-storage';

import type { TPasswordRecoveryResponse } from '@services/password-recovery/password-recovery.types';

type TRecoveryRequest = {
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
  // После ухода не записываем флаг восстановления и не меняем маршрут.
  const mountedRef = useRef(true);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Запоминаем успех API, чтобы при ошибке хранилища не повторять HTTP-запрос.
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
    };
  }, []);

  const submit = async (values: T): Promise<void> => {
    setIsSubmitting(true);
    setError('');
    try {
      // После успешного ответа API повторяем только запись/очистку флага:
      // код сброса уже мог быть использован, а письмо уже отправлено.
      if (!isConfirmed) {
        await request(values).unwrap();
        if (!mountedRef.current) return;
        setIsConfirmed(true);
      }
      try {
        complete();
      } catch {
        setError(passwordRecoveryStorageErrorMessage);
      }
    } catch {
      setError(requestErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, error, isSubmitting, isConfirmed };
};
