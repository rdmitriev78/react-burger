import { useState } from 'react';
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { selectAuth } from '@services/auth/auth-slice';
import { logout } from '@services/auth/auth-thunks';

import styles from './profile-layout.module.css';

export const ProfileLayout = (): React.JSX.Element => {
  const isProfilePage = useMatch('/profile') !== null;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoggingOut } = useAppSelector(selectAuth);
  const [error, setError] = useState('');
  const handleLogout = async (): Promise<void> => {
    setError('');
    try {
      if (await dispatch(logout())) void navigate('/', { replace: true });
    } catch {
      setError('Не удалось выйти. Повторите попытку.');
    }
  };

  return (
    <main className={styles.main}>
      <aside className={styles.sidebar}>
        <nav aria-label="Меню профиля" className={styles.menu}>
          <NavLink
            to="/profile"
            end
            className={({ isActive }) =>
              `${styles.link} text text_type_main-medium ${isActive ? styles.link_active : ''}`
            }
          >
            Профиль
          </NavLink>
          <NavLink
            to="/profile/orders"
            className={({ isActive }) =>
              `${styles.link} text text_type_main-medium ${isActive ? styles.link_active : ''}`
            }
          >
            История заказов
          </NavLink>
          <button
            type="button"
            className={`${styles.link} text text_type_main-medium`}
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            {isLoggingOut ? 'Выходим…' : 'Выход'}
          </button>
        </nav>
        {error && (
          <p role="alert" className="text text_type_main-default mt-4">
            {error}
          </p>
        )}
        <p
          className={`${styles.description} text text_type_main-default text_color_inactive mt-20`}
        >
          {isProfilePage
            ? 'В этом разделе вы можете изменить свои персональные данные'
            : 'В этом разделе вы можете просмотреть свою историю заказов'}
        </p>
      </aside>
      <div className={styles.content}>
        <Outlet />
      </div>
    </main>
  );
};
