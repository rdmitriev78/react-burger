import React from 'react';

import type { ErrorInfo, ReactNode } from 'react';

import styles from './error-boundary.module.css';

type TErrorBoundaryProps = {
  children: ReactNode;
};

type TErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends React.Component<TErrorBoundaryProps, TErrorBoundaryState> {
  constructor(props: TErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): TErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Возникла ошибка!', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className={styles.error} role="alert">
          <h1 className="text text_type_main-large mb-5">Что-то пошло не так :(</h1>
          <p
            className={`${styles.message} text text_type_main-default text_color_inactive`}
          >
            В приложении произошла ошибка. Пожалуйста, перезагрузите страницу.
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
