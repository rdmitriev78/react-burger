import { Button, EmailInput, Input } from '@krgaa/react-developer-burger-ui-components';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { ChangeEvent, FormEvent } from 'react';

import styles from './register.module.css';

export const RegisterPage = (): React.JSX.Element => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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
        aria-labelledby="register-title"
      >
        <h1 id="register-title" className="text text_type_main-medium">
          Регистрация
        </h1>
        <Input
          name="name"
          type="text"
          placeholder="Имя"
          aria-label="Имя"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          required
        />
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
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          icon={isPasswordVisible ? 'HideIcon' : 'ShowIcon'}
          onIconClick={() => setIsPasswordVisible((visible) => !visible)}
          minLength={6}
          required
        />
        <Button
          htmlType="submit"
          type="primary"
          size="medium"
          extraClass={styles.submit}
        >
          Зарегистрироваться
        </Button>
      </form>
      <p
        className={`${styles.actions} text text_type_main-default text_color_inactive mt-20`}
      >
        Уже зарегистрированы?{' '}
        <Link to="/login" className={styles.link}>
          Войти
        </Link>
      </p>
    </main>
  );
};
