import { Link } from 'react-router-dom';

import styles from './not-found.module.css';

const notFoundImage = new URL('../../assets/images/404.svg', import.meta.url).href;

export const NotFound = (): React.JSX.Element => (
  <main className={styles.not_found}>
    <img
      src={notFoundImage}
      alt=""
      width={360}
      height={200}
      className={`${styles.image} mb-10`}
    />
    <h1 className="text text_type_main-large mb-5">404 — Страница не найдена</h1>
    <p className="text text_type_main-default text_color_inactive mb-10">
      Такой страницы нет. Проверьте адрес или вернитесь на главную.
    </p>
    <Link to="/" className={`${styles.link} text text_type_main-default`}>
      Вернуться на главную
    </Link>
  </main>
);
