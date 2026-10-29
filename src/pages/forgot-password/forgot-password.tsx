import { Button, EmailInput } from '@krgaa/react-developer-burger-ui-components';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { ChangeEvent, FormEvent } from 'react';

import styles from './forgot-password.module.css';

export const ForgotPasswordPage = (): React.JSX.Element => {
  const [email, setEmail] = useState('');

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setEmail(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // Отправка данных будет добавлена при подключении API авторизации.
    event.preventDefault();
  };

  return (
    <main className={styles.main}>
      <form
        className={styles.form}
        onSubmit={handleSubmit}
        aria-labelledby="forgot-password-title"
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
        />
        <Button
          htmlType="submit"
          type="primary"
          size="medium"
          extraClass={styles.submit}
        >
          Восстановить
        </Button>
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
