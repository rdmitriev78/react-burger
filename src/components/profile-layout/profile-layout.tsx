import { NavLink, Outlet, useMatch } from 'react-router-dom';

import styles from './profile-layout.module.css';

export const ProfileLayout = (): React.JSX.Element => {
  const isProfilePage = useMatch('/profile') !== null;

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
            disabled
          >
            Выход
          </button>
        </nav>
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
