import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';

import { AppHeader } from '@components/app-header/app-header';
import { AppModals } from '@components/app-modals/app-modals';
import { useOrderSubmission } from '@hooks/use-order-submission';

import styles from './app.module.css';

export const App = (): React.JSX.Element => {
  const { stopWaiting } = useOrderSubmission();
  const constructorLinkRef = useRef<HTMLAnchorElement>(null);

  // Отменяем ожидание только при размонтировании приложения, а не отдельных потребителей хука.
  // OrderSubmission размонтируется при смене статуса, поэтому cleanup запроса не хранится в нём.
  useEffect(() => (): void => stopWaiting(), [stopWaiting]);

  return (
    <div className={styles.app}>
      <AppHeader constructorLinkRef={constructorLinkRef} />
      <Outlet />
      <AppModals ingredientFallbackFocusRef={constructorLinkRef} />
    </div>
  );
};

export default App;
