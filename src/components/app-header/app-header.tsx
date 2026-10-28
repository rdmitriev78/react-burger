import {
  BurgerIcon,
  ListIcon,
  Logo,
  ProfileIcon,
} from '@krgaa/react-developer-burger-ui-components';
import { Link, NavLink, useMatch } from 'react-router-dom';

import type { Ref } from 'react';

import styles from './app-header.module.css';

type TAppHeaderProps = {
  constructorLinkRef?: Ref<HTMLAnchorElement>;
};

export const AppHeader = ({
  constructorLinkRef,
}: TAppHeaderProps): React.JSX.Element => {
  const isHomeRoute = useMatch('/') !== null;
  const isIngredientRoute = useMatch('/ingredients/:id') !== null;
  const isConstructorActive = isHomeRoute || isIngredientRoute;
  return (
    <header className={styles.header}>
      <nav className={`${styles.menu} p-4`}>
        <div className={styles.menu_part_left}>
          <Link
            ref={constructorLinkRef}
            to="/"
            aria-current={isConstructorActive ? 'page' : undefined}
            className={`${styles.link} ${isConstructorActive ? styles.link_active : ''}`}
          >
            <BurgerIcon type={isConstructorActive ? 'primary' : 'secondary'} />
            <p className="text text_type_main-default ml-2">Конструктор</p>
          </Link>
          <NavLink
            to="/feed"
            className={({ isActive }) =>
              `${styles.link} ml-10 ${isActive ? styles.link_active : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <ListIcon type={isActive ? 'primary' : 'secondary'} />
                <p className="text text_type_main-default ml-2">Лента заказов</p>
              </>
            )}
          </NavLink>
        </div>
        <div className={styles.logo}>
          <Logo />
        </div>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `${styles.link} ${styles.link_position_last} ${isActive ? styles.link_active : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <ProfileIcon type={isActive ? 'primary' : 'secondary'} />
              <p className="text text_type_main-default ml-2">Личный кабинет</p>
            </>
          )}
        </NavLink>
      </nav>
    </header>
  );
};
