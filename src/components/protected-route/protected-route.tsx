import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ErrorView } from '@components/error-view/error-view';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { selectAuth } from '@services/auth/auth-slice';
import { checkSession } from '@services/auth/auth-thunks';

import { getReturnTo } from './return-to';

export const ProtectedRoute = ({
  onlyGuest = false,
}: {
  onlyGuest?: boolean;
}): React.JSX.Element => {
  const auth = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();
  const location = useLocation();
  if (auth.status === 'unknown' || auth.status === 'checking')
    return (
      <main>
        <RequestLoading message="Проверяем сессию…" />
      </main>
    );
  if (auth.status === 'error')
    return (
      <main>
        <ErrorView
          title="Не удалось проверить сессию"
          message={auth.message}
          buttonText="Повторить проверку"
          onButtonClick={() => void dispatch(checkSession())}
        />
      </main>
    );
  if (!onlyGuest && auth.status === 'anonymous')
    return (
      <Navigate
        to="/login"
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
        replace
      />
    );
  if (onlyGuest && auth.status === 'authenticated')
    return <Navigate to={getReturnTo(location.state)} replace />;
  return <Outlet />;
};
