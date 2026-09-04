import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';

import './styles.css';
import './lib/i18n';
import { MenuPage } from './routes/MenuPage';
import { Landing } from './routes/Landing';
import { loadBodyFont } from './lib/fonts';

/**
 * Le menu client tient en deux routes : la page d'un restaurant, et un écran d'aide pour
 * qui arrive à la racine sans avoir scanné de code.
 */

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
});

const menuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/r/$slug',
  component: MenuPage,
  validateSearch: (search: Record<string, unknown>) => ({
    /** Code de la table, transmis par la redirection du QR. Sert au pied de page. */
    t: typeof search.t === 'string' ? search.t : undefined,
    locale: typeof search.locale === 'string' ? search.locale : undefined,
  }),
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, menuRoute]),
  defaultPreload: false,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Le menu vit une minute : c'est la fenêtre annoncée par le cache HTTP.
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// La police de corps part après le premier rendu : le texte s'affiche d'abord, s'affine ensuite.
void loadBodyFont();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
