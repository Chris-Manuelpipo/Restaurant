import { StrictMode } from 'react';
import type { JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { ToastProvider } from '@evolyx/ui';

import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';

import { SessionProvider } from './lib/session';
import { getAccessToken } from './lib/api';
import { AppShell } from './components/AppShell';
import { LoginPage } from './routes/LoginPage';
import { InvitationPage } from './routes/InvitationPage';
import { OnboardingPage } from './routes/OnboardingPage';
import { MenuPage } from './routes/MenuPage';
import { RulesPage } from './routes/RulesPage';
import { AccessPointsPage } from './routes/AccessPointsPage';
import { BrandingPage } from './routes/BrandingPage';
import { TeamPage } from './routes/TeamPage';
import { AuditPage } from './routes/AuditPage';
import { PlatformPage } from './routes/PlatformPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  ),
});

/** Toute route sous ce parent exige une session ouverte. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: () => {
    if (!getAccessToken()) throw redirect({ to: '/connexion' });
  },
  component: AppShell,
});

const route = (path: string, component: () => JSX.Element) =>
  createRoute({ getParentRoute: () => authedRoute, path, component });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/connexion',
  component: LoginPage,
});

const invitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invitation/$token',
  component: InvitationPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  invitationRoute,
  authedRoute.addChildren([
    createRoute({
      getParentRoute: () => authedRoute,
      path: '/',
      beforeLoad: () => {
        throw redirect({ to: '/carte' });
      },
      component: () => <div />,
    }),
    route('/mise-en-service', OnboardingPage),
    route('/carte', MenuPage),
    route('/regles', RulesPage),
    route('/codes-qr', AccessPointsPage),
    route('/charte', BrandingPage),
    route('/equipe', TeamPage),
    route('/journal', AuditPage),
    route('/plateforme', PlatformPage),
  ]),
]);

const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
