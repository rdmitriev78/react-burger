import { Button } from '@krgaa/react-developer-burger-ui-components';

import styles from './request-error.module.css';

type TRequestErrorProps = {
  message: string;
  onRetry: () => void;
};

export const RequestError = ({
  message,
  onRetry,
}: TRequestErrorProps): React.JSX.Element => {
  return (
    <div className={styles.error}>
      <p role="alert" className="text text_type_main-medium mb-10">
        {message}
      </p>
      <Button onClick={onRetry} size="medium" type="primary" htmlType={'button'}>
        Повторить загрузку
      </Button>
    </div>
  );
};
