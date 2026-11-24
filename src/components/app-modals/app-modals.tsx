import { Button } from '@krgaa/react-developer-burger-ui-components';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';

import { ErrorModal } from '@components/error-modal/error-modal';
import { IngredientDetails } from '@components/ingredient-details/ingredient-details';
import { Modal } from '@components/modal/modal';
import { OrderDetails } from '@components/order-details/order-details';
import { OrderInfo } from '@components/order-info/order-info';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { burgerApi } from '@services/api/burger-api';
import { closeModal, selectModal } from '@services/modal/modal-slice';
import { selectOrderSubmission } from '@services/order/order-slice';
import { retryOrderStream } from '@services/orders/order-stream';
import { formatOrderNumber } from '@utils/order';

import type { TIngredient } from '@app-types/ingredient';
import type { TOrderInfoModal, TOrderInfoView } from '@services/modal/modal-slice.types';
import type { TOrderState } from '@services/order/order-slice.types';
import type { RefObject } from 'react';

import styles from './app-modals.module.css';

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

type TOrderInfoErrorProps = Pick<TOrderInfoModal, 'scope' | 'id'> & {
  view: Extract<TOrderInfoView, { status: 'error' }>;
  onClose: () => void;
};

const OrderInfoError = ({
  view,
  scope,
  id,
  onClose,
}: TOrderInfoErrorProps): React.JSX.Element => {
  const dispatch = useAppDispatch();

  const handleRetry = (): void => {
    if (view.retry === 'stream') dispatch(retryOrderStream(scope));
    else if (view.retry === 'catalog')
      void dispatch(
        burgerApi.endpoints.getIngredients.initiate(undefined, {
          subscribe: false,
          forceRefetch: true,
        })
      );
    else
      void dispatch(
        burgerApi.endpoints.getOrder.initiate(
          { id, scope },
          { subscribe: false, forceRefetch: true }
        )
      );
  };

  return (
    <>
      <p role="alert" className="text text_type_main-default mb-6">
        {view.message}
      </p>
      <div className={styles.actions}>
        {view.retry && (
          <Button onClick={handleRetry} size="medium" type="primary" htmlType="button">
            Повторить
          </Button>
        )}
        <Button onClick={onClose} size="medium" type="primary" htmlType="button">
          Закрыть
        </Button>
      </div>
    </>
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
  const isProfileOrderRoute = useMatch('/profile/orders/:id') !== null;
  const routeParent = isProfileOrderRoute
    ? '/profile/orders'
    : isFeedOrderRoute
      ? '/feed'
      : '/';
  const isClosingRouteRef = useRef(false);

  useEffect(() => {
    isClosingRouteRef.current = false;
  }, [location]);

  const handleRouteClose = useCallback((): void => {
    // Несколько событий закрытия до завершения перехода не должны вызвать несколько шагов назад.
    if (isClosingRouteRef.current) return;
    isClosingRouteRef.current = true;

    const state = location.state as {
      fromHome?: boolean;
      fromFeed?: boolean;
      fromProfileOrders?: boolean;
    } | null;
    const fromParent = isProfileOrderRoute
      ? state?.fromProfileOrders === true
      : isFeedOrderRoute
        ? state?.fromFeed === true
        : state?.fromHome === true;
    // Маркер относится к записи истории и сохраняется после reload.
    // Без маркера заменяем прямую ссылку родителем, чтобы не уйти из приложения.
    const navigation = fromParent
      ? navigate(-1)
      : navigate(routeParent, { replace: true });

    // При успешном переходе защиту сбросит смена location; при ошибке разрешаем повторить закрытие.
    void Promise.resolve(navigation).catch(() => {
      isClosingRouteRef.current = false;
    });
  }, [isFeedOrderRoute, isProfileOrderRoute, location.state, navigate, routeParent]);

  const handleApplicationClose = useCallback((): void => {
    dispatch(closeModal());
  }, [dispatch]);

  const getRouteFallbackFocus = useCallback((): HTMLElement | null => {
    // В cleanup нужен фактический адрес после перехода, а не location из прежнего рендера.
    if (window.location.pathname === '/profile/orders') {
      return document.querySelector<HTMLAnchorElement>(
        'nav[aria-label="Меню профиля"] a[href="/profile/orders"]'
      );
    }
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
    case 'order-info':
      return (
        <Modal
          title={
            modal.view.status === 'ready'
              ? `#${formatOrderNumber(modal.view.order.number)}`
              : modal.view.status === 'error'
                ? modal.view.title
                : 'Информация о заказе'
          }
          titleClassName={
            modal.view.status === 'ready' ? 'text text_type_digits-default' : undefined
          }
          ariaLabel={
            modal.view.status === 'error' ? modal.view.title : 'Информация о заказе'
          }
          onClose={handleClose}
          getFallbackFocus={getRouteFallbackFocus}
        >
          {modal.view.status === 'ready' && <OrderInfo order={modal.view.order} />}
          {modal.view.status === 'loading' && (
            <RequestLoading message={modal.view.message} />
          )}
          {modal.view.status === 'error' && (
            <OrderInfoError
              view={modal.view}
              scope={modal.scope}
              id={modal.id}
              onClose={handleClose}
            />
          )}
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
