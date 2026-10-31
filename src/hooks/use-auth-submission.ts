import { useEffect, useRef, useState } from 'react';

import { useAppDispatch, useAppStore } from '@hooks/redux';
import { establishSession } from '@services/auth/auth-thunks';
import { storageErrorMessage } from '@services/auth/token-storage';

import type { TAuthResponse } from '@services/auth/auth.types';

export const useAuthSubmission = <T>(
  request: (values: T) => Promise<TAuthResponse>,
  message: string
): {
  error: string;
  submit: (values: T) => Promise<void>;
} => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const [error, setError] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
    };
  }, []);

  const submit = async (values: T): Promise<void> => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError('');
    const version = store.getState().auth.version;
    try {
      const response = await request(values);
      dispatch(establishSession(response, version));
    } catch (cause: unknown) {
      if (mountedRef.current)
        setError(
          cause instanceof Error && cause.message === storageErrorMessage
            ? storageErrorMessage
            : message
        );
    } finally {
      pendingRef.current = false;
    }
  };

  return { error, submit };
};
