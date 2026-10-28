import { ErrorView } from '@components/error-view/error-view';
import { Modal } from '@components/modal/modal';

type TErrorModalProps = {
  title: string;
  message: string;
  buttonText: string;
  onClose: () => void;
  getFallbackFocus?: () => HTMLElement | null;
};

export const ErrorModal = ({
  title,
  message,
  buttonText,
  onClose,
  getFallbackFocus,
}: TErrorModalProps): React.JSX.Element => (
  <Modal ariaLabel={title} onClose={onClose} getFallbackFocus={getFallbackFocus}>
    <ErrorView
      title={title}
      message={message}
      buttonText={buttonText}
      onButtonClick={onClose}
    />
  </Modal>
);
