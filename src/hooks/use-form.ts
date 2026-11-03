import { useState } from 'react';

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

export function useForm<T extends Record<string, string>>(
  inputValues: T
): {
  values: T;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  setValues: Dispatch<SetStateAction<T>>;
} {
  const [values, setValues] = useState(inputValues);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value, name } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };
  return { values, handleChange, setValues };
}
