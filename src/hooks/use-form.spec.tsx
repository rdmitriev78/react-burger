import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useForm } from '@hooks/use-form';

import type { ChangeEvent } from 'react';

const change = (name: string, value: string): ChangeEvent<HTMLInputElement> =>
  ({ target: { name, value } }) as ChangeEvent<HTMLInputElement>;

describe('useForm', () => {
  it('сохраняет изменения разных полей до следующего рендера', () => {
    const initialValues = { email: '', password: '' };
    const { result } = renderHook(() => useForm(initialValues));

    act(() => {
      result.current.handleChange(change('email', 'test@example.test'));
      result.current.handleChange(change('password', 'secret'));
    });

    expect(result.current.values).toEqual({
      email: 'test@example.test',
      password: 'secret',
    });
    expect(initialValues).toEqual({ email: '', password: '' });
  });

  it('хранит значения экземпляров независимо', () => {
    const { result } = renderHook(() => ({
      first: useForm({ email: '' }),
      second: useForm({ email: '' }),
    }));

    act(() => result.current.first.handleChange(change('email', 'first@example.test')));

    expect(result.current.first.values.email).toBe('first@example.test');
    expect(result.current.second.values.email).toBe('');
  });

  it('позволяет заменить черновик подтверждёнными значениями и очистить пароль', () => {
    const { result } = renderHook(() =>
      useForm({ name: 'Старое имя', email: 'old@example.test', password: '' })
    );

    act(() => {
      result.current.handleChange(change('name', 'Черновик'));
      result.current.handleChange(change('password', 'secret'));
    });
    act(() => {
      result.current.setValues({
        name: 'Подтверждённое имя',
        email: 'saved@example.test',
        password: '',
      });
    });

    expect(result.current.values).toEqual({
      name: 'Подтверждённое имя',
      email: 'saved@example.test',
      password: '',
    });
  });
});
