import styles from './feed.module.css';

export const FeedPage = (): React.JSX.Element => (
  <main className={`${styles.main}`}>
    <h1 className="text text_type_main-large mt-20 mb-6">Лента заказов</h1>
    <p className="text text_type_main-default text_color_inactive">
      Страница находится в разработке
    </p>
  </main>
);
