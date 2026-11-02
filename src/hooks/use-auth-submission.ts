import { useEffect, useRef, useState } from 'react';

import { useAppDispatch, useAppStore } from '@hooks/redux';
import { selectSessionVersion } from '@services/auth/auth-slice';
import { establishSession } from '@services/auth/auth-thunks';
import { storageErrorMessage } from '@services/auth/token-storage';

import type { TAuthResponse } from '@services/auth/auth.types';

type TAuthRequest = {
  abort: () => void;
  unwrap: () => Promise<TAuthResponse>;
};

export const useAuthSubmission = <T>(
  request: (values: T) => TAuthRequest,
  message: string
): {
  error: string;
  submit: (values: T) => Promise<void>;
} => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  // Сохраняем операцию для отмены при уходе на другую форму или страницу.
  const requestRef = useRef<TAuthRequest | null>(null);
  const [error, setError] = useState('');

  useEffect(() => (): void => requestRef.current?.abort(), []);

  const submit = async (values: T): Promise<void> => {
    const version = selectSessionVersion(store.getState());
    setError('');
    try {
      const operation = request(values);
      requestRef.current = operation;
      const response = await operation.unwrap();
      dispatch(establishSession(response, version));
    } catch (cause: unknown) {
      setError(
        cause instanceof Error && cause.message === storageErrorMessage
          ? storageErrorMessage
          : message
      );
    } finally {
      requestRef.current = null;
    }
  };

  return { error, submit };
};
