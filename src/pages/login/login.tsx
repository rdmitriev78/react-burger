import { Button, EmailInput, Input } from '@krgaa/react-developer-burger-ui-components';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { ChangeEvent, FormEvent } from 'react';

import styles from './login.module.css';

export const LoginPage = (): React.JSX.Element => {
  const [form, setForm] = useState({ email: '', password: '' });
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
        aria-labelledby="login-title"
      >
        <h1 id="login-title" className="text text_type_main-medium">
          Вход
        </h1>
        <EmailInput
          name="email"
          placeholder="E-mail"
          aria-label="E-mail"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          errorText="Введите корректный e-mail"
          required
        />
        <Input
          name="password"
          type={isPasswordVisible ? 'text' : 'password'}
          placeholder="Пароль"
          aria-label="Пароль"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          icon={isPasswordVisible ? 'HideIcon' : 'ShowIcon'}
          onIconClick={() => setIsPasswordVisible((visible) => !visible)}
          required
        />
        <Button
          htmlType="submit"
          type="primary"
          size="medium"
          extraClass={styles.submit}
        >
          Войти
        </Button>
      </form>
      <div className={`${styles.actions} mt-20`}>
        <p className="text text_type_main-default text_color_inactive">
          Вы — новый пользователь?{' '}
          <Link to="/register" className={styles.link}>
            Зарегистрироваться
          </Link>
        </p>
        <p className="text text_type_main-default text_color_inactive mt-4">
          Забыли пароль?{' '}
          <Link to="/forgot-password" className={styles.link}>
            Восстановить пароль
          </Link>
        </p>
      </div>
    </main>
  );
};
