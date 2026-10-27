import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

import { ErrorView } from '@components/error-view/error-view';

import styles from './route-error.module.css';

export const RouteError = (): React.JSX.Element => {
  const error: unknown = useRouteError();

  useEffect(() => {
    console.error('Ошибка маршрута:', error);
  }, [error]);

  return (
    <main className={styles.error}>
      <ErrorView
        title="Что-то пошло не так :("
        message="В приложении произошла ошибка. Пожалуйста, перезагрузите страницу."
        buttonText="Перезагрузить страницу"
        onButtonClick={(): void => window.location.reload()}
      />
    </main>
  );
};
