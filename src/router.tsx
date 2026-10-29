import { createBrowserRouter } from 'react-router-dom';

import { App } from '@components/app/app';
import { IngredientModalRoute } from '@components/ingredient-modal-route/ingredient-modal-route';
import { ForgotPasswordPage } from '@pages/forgot-password/forgot-password';
import { Home } from '@pages/home/home';
import { LoginPage } from '@pages/login/login';
import { NotFound } from '@pages/not-found/not-found';
import { RegisterPage } from '@pages/register/register';
import { RouteError } from '@pages/route-error/route-error';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/',
        element: <Home />,
        children: [
          {
            path: 'ingredients/:id',
            element: <IngredientModalRoute />,
          },
        ],
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
