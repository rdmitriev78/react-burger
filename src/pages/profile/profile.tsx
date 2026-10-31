import { Input } from '@krgaa/react-developer-burger-ui-components';
import { useRef, useState } from 'react';

import type { ChangeEvent, FormEvent } from 'react';

import styles from './profile.module.css';

type TProfileForm = {
  name: string;
  email: string;
  password: string;
};

type TProfileField = keyof TProfileForm;

const fields: { name: TProfileField; label: string; autoComplete: string }[] = [
  { name: 'name', label: 'Имя', autoComplete: 'name' },
  { name: 'email', label: 'Логин', autoComplete: 'email' },
  { name: 'password', label: 'Пароль', autoComplete: 'new-password' },
];

export const ProfilePage = (): React.JSX.Element => {
  const [form, setForm] = useState<TProfileForm>({
    name: '',
    email: '',
    password: '',
  });
  const [editingField, setEditingField] = useState<TProfileField | null>(null);
  const inputRefs = useRef<Record<TProfileField, HTMLInputElement | null>>({
    name: null,
    email: null,
    password: null,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
  };

  const handleEdit = (name: TProfileField): void => {
    setEditingField(name);
    inputRefs.current[name]?.focus();
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-labelledby="profile-title"
    >
      <h1 id="profile-title" className="visually-hidden">
        Профиль
      </h1>
      {fields.map(({ name, label, autoComplete }) => (
        <Input
          key={name}
          ref={(input) => {
            inputRefs.current[name] = input;
          }}
          name={name}
          type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
          placeholder={label}
          aria-label={label}
          autoComplete={autoComplete}
          value={form[name]}
          readOnly={editingField !== name}
          onChange={handleChange}
          onBlur={() => setEditingField(null)}
          icon="EditIcon"
          onIconClick={() => handleEdit(name)}
          extraClass={styles.input}
        />
      ))}
    </form>
  );
};
