import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';

import { ErrorModal } from '@components/error-modal/error-modal';
import { FeedOrderDetails } from '@components/feed-order-details/feed-order-details';
import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { closeModal, selectModal } from '@services/modal/modal-slice';
import { selectOrderSubmission } from '@services/order/order-slice';
import { formatFeedOrderNumber } from '@utils/feed-order';

import type { TIngredient } from '@app-types/ingredient';
import type { TOrderState } from '@services/order/order-slice.types';
import type { RefObject } from 'react';

const orderModalLabels = {
  submitting: 'Оформление заказа',
  success: 'Заказ оформлен',
  error: 'Ошибка оформления заказа',
  stopped: 'Ожидание прекращено',
} satisfies Record<Exclude<TOrderState['status'], 'idle'>, string>;

type TIngredientModalProps = {
  ingredient: TIngredient;
  onClose: () => void;
  getFallbackFocus: () => HTMLElement | null;
};

const IngredientModal = ({
  ingredient,
  onClose,
  getFallbackFocus,
}: TIngredientModalProps): React.JSX.Element => (
  <Modal
    title="Детали ингредиента"
    onClose={onClose}
    getFallbackFocus={getFallbackFocus}
  >
    <IngredientDetails ingredient={ingredient} />
  </Modal>
);

type TOrderModalProps = {
  onClose: () => void;
};

const OrderModal = ({ onClose }: TOrderModalProps): React.JSX.Element | null => {
  const order = useAppSelector(selectOrderSubmission);

  if (order.status === 'idle') return null;

  return (
    <Modal
      ariaLabel={orderModalLabels[order.status]}
      onClose={onClose}
      canClose={order.status !== 'submitting'}
    >
      <OrderDetails order={order} />
    </Modal>
  );
};

// Новый тип модалки требует отдельного case; неожиданное значение перехватит ErrorBoundary.
const assertNever = (_value: never): never => {
  throw new Error('Неизвестный тип модального окна');
};

type TAppModalsProps = {
  ingredientFallbackFocusRef: RefObject<HTMLAnchorElement | null>;
  feedFallbackFocusRef?: RefObject<HTMLAnchorElement | null>;
};

// Redux выбирает один диалог; source определяет способ его закрытия.
export const AppModals = ({
  ingredientFallbackFocusRef,
  feedFallbackFocusRef,
}: TAppModalsProps): React.JSX.Element | null => {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectModal);
  const location = useLocation();
  const navigate = useNavigate();
  const isFeedOrderRoute = useMatch('/feed/:id') !== null;
  const isClosingRouteRef = useRef(false);

  useEffect(() => {
    isClosingRouteRef.current = false;
  }, [location]);

  const handleRouteClose = useCallback((): void => {
    // Несколько событий закрытия до завершения перехода не должны вызвать несколько шагов назад.
    if (isClosingRouteRef.current) return;
    isClosingRouteRef.current = true;

    const state = location.state as { fromHome?: boolean; fromFeed?: boolean } | null;
    const fromParent = isFeedOrderRoute
      ? state?.fromFeed === true
      : state?.fromHome === true;
    // Маркер относится к записи истории и сохраняется после reload.
    // Без маркера заменяем прямую ссылку родителем, чтобы не уйти из приложения.
    const navigation = fromParent
      ? navigate(-1)
      : navigate(isFeedOrderRoute ? '/feed' : '/', { replace: true });

    // При успешном переходе защиту сбросит смена location; при ошибке разрешаем повторить закрытие.
    void Promise.resolve(navigation).catch(() => {
      isClosingRouteRef.current = false;
    });
  }, [isFeedOrderRoute, location.state, navigate]);

  const handleApplicationClose = useCallback((): void => {
    dispatch(closeModal());
  }, [dispatch]);

  const getRouteFallbackFocus = useCallback((): HTMLElement | null => {
    // В cleanup нужен фактический адрес после перехода, а не location из прежнего рендера.
    return (
      [ingredientFallbackFocusRef.current, feedFallbackFocusRef?.current].find(
        (link) => link && new URL(link.href).pathname === window.location.pathname
      ) ?? null
    );
  }, [feedFallbackFocusRef, ingredientFallbackFocusRef]);

  const handleClose =
    modal.type !== 'closed' && modal.source === 'route'
      ? handleRouteClose
      : handleApplicationClose;

  switch (modal.type) {
    case 'closed':
      return null;
    case 'ingredient':
      return (
        <IngredientModal
          ingredient={modal.ingredient}
          onClose={handleClose}
          getFallbackFocus={getRouteFallbackFocus}
        />
      );
    case 'order':
      return <OrderModal onClose={handleClose} />;
    case 'feed-order':
      return (
        <Modal
          title={`#${formatFeedOrderNumber(modal.order.number)}`}
          titleClassName="text text_type_digits-default"
          ariaLabel="Информация о заказе"
          onClose={handleClose}
          getFallbackFocus={getRouteFallbackFocus}
        >
          <FeedOrderDetails order={modal.order} />
        </Modal>
      );
    case 'error':
      return (
        <ErrorModal
          title={modal.title}
          message={modal.message}
          buttonText={modal.buttonText}
          onClose={handleClose}
          getFallbackFocus={modal.source === 'route' ? getRouteFallbackFocus : undefined}
        />
      );
    default:
      // на случай появления нового типа
      return assertNever(modal);
  }
};
