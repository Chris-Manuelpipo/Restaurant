import { useEffect } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Button, Spin } from '@evolyx/ui';
import { MODULES } from '@evolyx/shared';
import type { JSX, ReactNode } from 'react';
import { useSession } from '../lib/session';
import { logout } from '../lib/api';

/**
 * Coque du back-office.
 *
 * La navigation se **déduit** des modules actifs et des capacités du rôle : ni liste en dur,
 * ni condition sur le nom d'un restaurant. Activer le module Commande demain ajoutera son
 * entrée ici sans toucher à ce fichier — il suffira de l'ajouter au tableau ci-dessous.
 */

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  capability?: string;
  module?: string;
  section: 'quotidien' | 'reglages' | 'plateforme';
}

const NAV: NavEntry[] = [
  {
    to: '/carte',
    label: 'La carte',
    section: 'quotidien',
    capability: 'menu:read',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h16v16H4zM4 9h16M9 9v11" />
      </svg>
    ),
  },
  {
    to: '/regles',
    label: 'Horaires des plats',
    section: 'quotidien',
    capability: 'rules:read',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    to: '/codes-qr',
    label: 'Codes QR',
    section: 'quotidien',
    capability: 'access_points:read',
    module: MODULES.MENU_QR,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
      </svg>
    ),
  },
  {
    to: '/charte',
    label: 'Identité et charte',
    section: 'reglages',
    capability: 'restaurant:write',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h3.5a4.5 4.5 0 0 0 0-9z" />
        <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: '/equipe',
    label: 'L’équipe',
    section: 'reglages',
    capability: 'users:read',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20a6 6 0 0 1 12 0M16 5.5a3.2 3.2 0 0 1 0 6M18 20a5.5 5.5 0 0 0-2-4.3" />
      </svg>
    ),
  },
  {
    to: '/journal',
    label: 'Journal',
    section: 'reglages',
    capability: 'audit:read',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 4h11l3 3v13H5zM8 10h8M8 14h8M8 18h5" />
      </svg>
    ),
  },
  {
    to: '/plateforme',
    label: 'Restaurants',
    section: 'plateforme',
    capability: 'platform:manage',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 20V9l6-4 6 4v11M9 20v-5h4v5M15 20h6V12l-6-3" />
      </svg>
    ),
  },
];

const SECTION_LABELS: Record<NavEntry['section'], string> = {
  quotidien: 'Au quotidien',
  reglages: 'Réglages',
  plateforme: 'Plateforme',
};

export function AppShell(): JSX.Element {
  const { session, isLoading, can, hasModule } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!isLoading && !session) void navigate({ to: '/connexion' });
  }, [isLoading, session, navigate]);

  if (isLoading) {
    return (
      <div className="grid place-items-center min-h-dvh">
        <Spin label="Ouverture de votre espace…" />
      </div>
    );
  }

  if (!session) return <div />;

  const visible = NAV.filter(
    (entry) =>
      (!entry.capability || can(entry.capability)) &&
      (!entry.module || hasModule(entry.module as never)),
  );

  const sections = ['quotidien', 'reglages', 'plateforme'] as const;
  const restaurant = session.restaurant;
  const onboardingPending = restaurant && restaurant.onboardingCompletedAt === null;

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand__mark">E</div>
          <div className="min-w-0">
            <b className="brand__name">Evolyx</b>
            <span className="brand__sub">{restaurant?.name ?? 'Plateforme'}</span>
          </div>
        </div>

        {onboardingPending ? (
          <Link to="/mise-en-service" className="nav-link" data-active={pathname === '/mise-en-service'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-6.8L2 9.6 9 9z" />
            </svg>
            Terminer la mise en service
          </Link>
        ) : null}

        <nav className="mt-2 flex-1">
          {sections.map((section) => {
            const entries = visible.filter((entry) => entry.section === section);
            if (entries.length === 0) return null;
            return (
              <div key={section}>
                <p className="nav-kicker">{SECTION_LABELS[section]}</p>
                {entries.map((entry) => (
                  <Link
                    key={entry.to}
                    to={entry.to}
                    className="nav-link"
                    data-active={pathname === entry.to}
                  >
                    {entry.icon}
                    {entry.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="pt-4 border-t" style={{ borderColor: 'var(--rule-2)' }}>
          <p className="text-[12.5px] font-semibold truncate">{session.user.fullName}</p>
          <p className="text-[11.5px] mb-3" style={{ color: 'var(--ink-3)' }}>
            {roleLabel(session.user.role)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              void navigate({ to: '/connexion' });
            }}
          >
            Se déconnecter
          </Button>
        </div>
      </aside>

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export function roleLabel(role: string): string {
  return (
    {
      PLATFORM_ADMIN: 'Administration Evolyx',
      ADMIN: 'Administrateur',
      MANAGER: 'Gérant',
      STAFF: 'Salle',
    }[role] ?? role
  );
}
