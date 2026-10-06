import React from 'react';

import { ErrorView } from '@components/error-view/error-view';

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
        <main className={styles.error}>
          <ErrorView
            title="Что-то пошло не так :("
            message="В приложении произошла ошибка. Пожалуйста, перезагрузите страницу."
            buttonText="Перезагрузить страницу"
            onButtonClick={(): void => window.location.reload()}
          />
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
