import { Preloader } from '@krgaa/react-developer-burger-ui-components';

import styles from './request-loading.module.css';

type TRequestLoadingProps = {
  message: string;
};

export const RequestLoading = ({ message }: TRequestLoadingProps): React.JSX.Element => {
  return (
    <div className={styles.loading}>
      <p className="text text_type_main-medium mb-10">{message}</p>
      <Preloader />
    </div>
  );
};
