import { Button, Input } from '@krgaa/react-developer-burger-ui-components';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { burgerApi } from '@services/api/burger-api';
import { selectAuth } from '@services/auth/auth-slice';
import { profileSubmissionCacheKey, saveProfile } from '@services/auth/auth-thunks';

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
  const dispatch = useAppDispatch();
  const { user, version } = useAppSelector(selectAuth);
  const selectSubmission = useMemo(
    () =>
      burgerApi.endpoints.updateCurrentUser.select(profileSubmissionCacheKey(version)),
    [version]
  );
  const { isLoading: isSubmitting } = useAppSelector(selectSubmission);
  const [form, setForm] = useState<TProfileForm>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
  });
  const [editingField, setEditingField] = useState<TProfileField | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  // PATCH продолжает обновлять сессию после ухода; локальные действия формы уже не нужны.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
    };
  }, []);
  const inputRefs = useRef<Record<TProfileField, HTMLInputElement | null>>({
    name: null,
    email: null,
    password: null,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (isSubmitting || !isEditing) return;
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!isEditing || isSubmitting) return;
    setError('');
    void submit();
  };

  const submit = async (): Promise<void> => {
    try {
      const confirmed = await dispatch(saveProfile(form));
      if (!mountedRef.current || !confirmed) return;
      setForm({ ...confirmed, password: '' });
      setIsEditing(false);
      setEditingField(null);
    } catch {
      if (mountedRef.current)
        setError('Не удалось сохранить изменения. Повторите попытку.');
    }
  };

  const handleCancel = (): void => {
    if (isSubmitting) return;
    setForm({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
    setError('');
    setIsEditing(false);
    setEditingField(null);
  };

  const handleEdit = (name: TProfileField): void => {
    if (isSubmitting) return;
    if (!isEditing)
      setForm({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
    setIsEditing(true);
    setEditingField(name);
    inputRefs.current[name]?.focus();
  };

  // После возвращения на страницу результат общего PATCH виден прямо из user.
  const values = isEditing
    ? form
    : { name: user?.name ?? '', email: user?.email ?? '', password: '' };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-labelledby="profile-title"
      aria-busy={isSubmitting}
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
          value={values[name]}
          disabled={isSubmitting}
          readOnly={editingField !== name}
          onChange={handleChange}
          onBlur={() => setEditingField(null)}
          icon="EditIcon"
          onIconClick={isSubmitting ? undefined : (): void => handleEdit(name)}
          extraClass={styles.input}
        />
      ))}
      {isEditing ? (
        <div className={styles.actions}>
          <Button
            htmlType="button"
            type="secondary"
            size="medium"
            disabled={isSubmitting}
            onClick={handleCancel}
          >
            Отмена
          </Button>
          <Button htmlType="submit" type="primary" size="medium" disabled={isSubmitting}>
            {isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      ) : isSubmitting ? (
        <p role="status" className="text text_type_main-default">
          Сохраняем…
        </p>
      ) : null}
      {error && (
        <p role="alert" className="text text_type_main-default">
          {error}
        </p>
      )}
    </form>
  );
};
