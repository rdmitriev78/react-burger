import { ErrorView } from '@components/error-view/error-view';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useAppDispatch } from '@hooks/redux';
import { burgerApi } from '@services/api/burger-api';
import { retryOrderStream } from '@services/orders/order-stream';

import type { TOrderStreamContext } from '@hooks/use-order-stream';
import type { ReactNode } from 'react';

export const OrderStreamState = ({
  context,
  children,
}: {
  context: TOrderStreamContext;
  children: ReactNode;
}): React.JSX.Element => {
  const dispatch = useAppDispatch();
  const retry = (): void => {
    if (context.catalogStatus === 'error')
      void dispatch(
        burgerApi.endpoints.getIngredients.initiate(undefined, {
          subscribe: false,
          forceRefetch: true,
        })
      );
    else dispatch(retryOrderStream(context.scope));
  };
  if (
    context.catalogStatus === 'error' ||
    (!context.stream.snapshot && context.stream.message)
  )
    return (
      <ErrorView
        title="Не удалось загрузить заказы"
        message={
          context.catalogStatus === 'error'
            ? 'Не удалось загрузить ингредиенты.'
            : context.stream.message
        }
        buttonText="Повторить"
        onButtonClick={retry}
      />
    );
  if (!context.stream.snapshot || context.catalogStatus === 'loading')
    return <RequestLoading message="Загружаем заказы…" />;
  return (
    <>
      {context.stream.message && (
        <div role="status" className="mb-4">
          <p className="text text_type_main-default">{context.stream.message}</p>
          <button type="button" onClick={retry}>
            Повторить подключение
          </button>
        </div>
      )}
      {children}
    </>
  );
};
