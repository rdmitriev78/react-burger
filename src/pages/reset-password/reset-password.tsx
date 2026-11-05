import { Button, Input } from '@krgaa/react-developer-burger-ui-components';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ErrorView } from '@components/error-view/error-view';
import { useForm } from '@hooks/use-form';
import { usePasswordRecoverySubmission } from '@hooks/use-password-recovery-submission';
import { useResetPasswordMutation } from '@services/api/burger-api';
import {
  clearPasswordResetRequest,
  hasPasswordResetRequest,
  passwordRecoveryStorageErrorMessage,
} from '@services/password-recovery/password-recovery-storage';

import type { FormEvent } from 'react';

import styles from './reset-password.module.css';

const readResetPermission = (): boolean | null => {
  try {
    return hasPasswordResetRequest();
  } catch {
    return null;
  }
};

export const ResetPasswordPage = (): React.JSX.Element => {
  const [isAllowed, setIsAllowed] = useState(readResetPermission);
  const { values: form, handleChange } = useForm({ password: '', token: '' });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const navigate = useNavigate();
  const [resetPassword] = useResetPasswordMutation();
  const { submit, error, isSubmitting, isConfirmed } = usePasswordRecoverySubmission(
    resetPassword,
    () => {
      clearPasswordResetRequest();
      void navigate('/login', { replace: true });
    },
    'Не удалось сбросить пароль. Проверьте код и повторите попытку.'
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submit(form);
  };

  if (isAllowed === null)
    return (
      <main className={styles.main}>
        <ErrorView
          title="Не удалось проверить шаг восстановления"
          message={passwordRecoveryStorageErrorMessage}
          buttonText="Повторить проверку"
          onButtonClick={() => setIsAllowed(readResetPermission())}
        />
      </main>
    );
  if (!isAllowed) return <Navigate to="/forgot-password" replace />;

  return (
    <main className={styles.main}>
      <form
        className={styles.form}
        onSubmit={handleSubmit}
        aria-labelledby="reset-password-title"
        aria-busy={isSubmitting}
      >
        <h1 id="reset-password-title" className="text text_type_main-medium">
          Восстановление пароля
        </h1>
        <Input
          name="password"
          type={isPasswordVisible ? 'text' : 'password'}
          placeholder="Введите новый пароль"
          aria-label="Введите новый пароль"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          icon={isPasswordVisible ? 'HideIcon' : 'ShowIcon'}
          onIconClick={() => setIsPasswordVisible((visible) => !visible)}
          readOnly={isConfirmed}
          required
        />
        <Input
          name="token"
          type="text"
          placeholder="Введите код из письма"
          aria-label="Введите код из письма"
          autoComplete="one-time-code"
          readOnly={isConfirmed}
          value={form.token}
          onChange={handleChange}
          required
        />
        <Button
          disabled={isSubmitting}
          htmlType="submit"
          type="primary"
          size="medium"
          extraClass={styles.submit}
        >
          {isSubmitting
            ? 'Сохраняем…'
            : isConfirmed
              ? 'Повторить завершение'
              : 'Сохранить'}
        </Button>
        {error && (
          <p role="alert" className="text text_type_main-default">
            {error}
          </p>
        )}
      </form>
      <p
        className={`${styles.actions} text text_type_main-default text_color_inactive mt-20`}
      >
        Вспомнили пароль?{' '}
        <Link to="/login" className={styles.link}>
          Войти
        </Link>
      </p>
      <p
        className={`${styles.actions} text text_type_main-default text_color_inactive mt-4`}
      >
        <Link to="/forgot-password" className={styles.link}>
          Не пришло письмо? Запросить ещё раз
        </Link>
      </p>
    </main>
  );
};
