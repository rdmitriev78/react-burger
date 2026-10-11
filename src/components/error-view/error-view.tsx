import { Button } from '@krgaa/react-developer-burger-ui-components';

import styles from './error-view.module.css';

type TErrorViewProps = {
  title: string;
  message: string;
  buttonText: string;
  onButtonClick: () => void;
};

export const ErrorView = ({
  title,
  message,
  buttonText,
  onButtonClick,
}: TErrorViewProps): React.JSX.Element => {
  return (
    <section className={styles.error}>
      <div role="alert">
        <h1 className="text text_type_main-large mb-5">{title}</h1>
        <p
          className={`${styles.message} text text_type_main-default text_color_inactive mb-10`}
        >
          {message}
        </p>
      </div>
      <Button onClick={onButtonClick} size="medium" type="primary" htmlType="button">
        {buttonText}
      </Button>
    </section>
  );
};
