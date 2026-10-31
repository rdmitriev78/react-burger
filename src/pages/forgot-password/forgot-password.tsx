import { Button, EmailInput } from '@krgaa/react-developer-burger-ui-components';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { usePasswordRecoverySubmission } from '@hooks/use-password-recovery-submission';
import { useRequestPasswordResetMutation } from '@services/api/burger-api';
import { markPasswordResetRequested } from '@services/password-recovery/password-recovery-storage';

import type { ChangeEvent, FormEvent } from 'react';

import styles from './forgot-password.module.css';

export const ForgotPasswordPage = (): React.JSX.Element => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const [requestPasswordReset] = useRequestPasswordResetMutation();
  const { submit, error, isSubmitting, isConfirmed } = usePasswordRecoverySubmission(
    requestPasswordReset,
    () => {
      markPasswordResetRequested();
      void navigate('/reset-password', { replace: true });
    },
    'Не удалось запросить письмо. Проверьте e-mail и повторите попытку.'
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setEmail(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submit({ email });
  };

  return (
    <main className={styles.main}>
      <form
        className={styles.form}
        onSubmit={handleSubmit}
        aria-labelledby="forgot-password-title"
        aria-busy={isSubmitting}
      >
        <h1 id="forgot-password-title" className="text text_type_main-medium">
          Восстановление пароля
        </h1>
        <EmailInput
          name="email"
          placeholder="Укажите e-mail"
          aria-label="Укажите e-mail"
          autoComplete="email"
          value={email}
          onChange={handleChange}
          errorText="Введите корректный e-mail"
          required
          readOnly={isConfirmed}
        />
        <Button
          disabled={isSubmitting}
          htmlType="submit"
          type="primary"
          size="medium"
          extraClass={styles.submit}
        >
          {isSubmitting
            ? 'Отправляем…'
            : isConfirmed
              ? 'Повторить сохранение'
              : 'Восстановить'}
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
    </main>
  );
};
