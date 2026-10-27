import { createBrowserRouter } from 'react-router-dom';

import { App } from '@components/app/app';
import { Home } from '@pages/home/home';
import { NotFound } from '@pages/not-found/not-found';
import { RouteError } from '@pages/route-error/route-error';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
