import { Button, Input } from '@krgaa/react-developer-burger-ui-components';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { ChangeEvent, FormEvent } from 'react';

import styles from './reset-password.module.css';

export const ResetPasswordPage = (): React.JSX.Element => {
  const [form, setForm] = useState({ password: '', token: '' });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
        aria-labelledby="reset-password-title"
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
          minLength={6}
          required
        />
        <Input
          name="token"
          type="text"
          placeholder="Введите код из письма"
          aria-label="Введите код из письма"
          autoComplete="one-time-code"
          value={form.token}
          onChange={handleChange}
          required
        />
        <Button
          htmlType="submit"
          type="primary"
          size="medium"
          extraClass={styles.submit}
        >
          Сохранить
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
