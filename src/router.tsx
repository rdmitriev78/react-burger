import { createBrowserRouter } from 'react-router-dom';

import { App } from '@components/app/app';
import { IngredientModalRoute } from '@components/ingredient-modal-route/ingredient-modal-route';
import { ProtectedRoute } from '@components/protected-route/protected-route';
import { RequestLoading } from '@components/request-loading/request-loading';
import { RouteError } from '@pages/route-error/route-error';

import type { ComponentType } from 'react';

type TRouteModule = { Component: ComponentType };

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    // В data router этот fallback показывается до загрузки первого lazy-маршрута.
    hydrateFallbackElement: (
      <main>
        <RequestLoading message="Загружаем страницу…" />
      </main>
    ),
    children: [
      {
        path: '/',
        lazy: async (): Promise<TRouteModule> => ({
          Component: (await import('@pages/home/home')).Home,
        }),
        children: [
          {
            path: 'ingredients/:id',
            element: <IngredientModalRoute />,
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'profile',
            lazy: async (): Promise<TRouteModule> => ({
              Component: (await import('@components/profile-layout/profile-layout'))
                .ProfileLayout,
            }),
            children: [
              {
                index: true,
                lazy: async (): Promise<TRouteModule> => ({
                  Component: (await import('@pages/profile/profile')).ProfilePage,
                }),
              },
              {
                path: 'orders',
                lazy: async (): Promise<TRouteModule> => ({
                  Component: (await import('@pages/profile-order/profile-order'))
                    .ProfileOrderPage,
                }),
              },
            ],
          },
        ],
      },
      {
        path: 'feed',
        lazy: async (): Promise<TRouteModule> => ({
          Component: (await import('@pages/feed/feed')).FeedPage,
        }),
      },
      {
        element: <ProtectedRoute onlyGuest />,
        children: [
          {
            path: 'login',
            lazy: async (): Promise<TRouteModule> => ({
              Component: (await import('@pages/login/login')).LoginPage,
            }),
          },
          {
            path: 'register',
            lazy: async (): Promise<TRouteModule> => ({
              Component: (await import('@pages/register/register')).RegisterPage,
            }),
          },
          {
            path: 'forgot-password',
            lazy: async (): Promise<TRouteModule> => ({
              Component: (await import('@pages/forgot-password/forgot-password'))
                .ForgotPasswordPage,
            }),
          },
          {
            path: 'reset-password',
            lazy: async (): Promise<TRouteModule> => ({
              Component: (await import('@pages/reset-password/reset-password'))
                .ResetPasswordPage,
            }),
          },
        ],
      },
      {
        path: '*',
        lazy: async (): Promise<TRouteModule> => ({
          Component: (await import('@pages/not-found/not-found')).NotFound,
        }),
      },
    ],
  },
]);
