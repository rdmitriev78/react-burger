import styles from './profile-order.module.css';

export const ProfileOrderPage = (): React.JSX.Element => (
  <section className={styles.section} aria-labelledby="profile-orders-title">
    <h1 id="profile-orders-title" className="text text_type_main-medium mt-10 mb-6">
      История заказов
    </h1>
    <p className="text text_type_main-default text_color_inactive">
      Страница находится в разработке
    </p>
  </section>
);
