import { useEffect, useState } from 'react';

/**
 * Routage du menu client.
 *
 * Le menu a deux écrans : la page d'un restaurant, et un écran d'aide pour qui arrive à la
 * racine. Un routeur complet coûterait ici vingt-huit kilo-octets transférés — sur une 4G
 * lente, plus d'une demi-seconde avant que quoi que ce soit ne s'affiche, pour une seule
 * expression régulière. Le back-office, lui, garde TanStack Router : il en a l'usage.
 *
 * Voir docs/PERFORMANCE.md pour la mesure qui a motivé ce choix.
 */

export interface Route {
  /** Slug du restaurant, ou null sur la page d'accueil. */
  slug: string | null;
  /** Code de la table, transmis par la redirection du QR (`?t=…`). */
  table?: string;
  /** Langue forcée par l'URL, le cas échéant. */
  locale?: string;
}

export function parseRoute(url: URL = new URL(window.location.href)): Route {
  const match = /^\/r\/([^/]+)/.exec(url.pathname);
  const table = url.searchParams.get('t');
  const locale = url.searchParams.get('locale');

  return {
    slug: match?.[1] ? decodeURIComponent(match[1]) : null,
    ...(table ? { table } : {}),
    ...(locale ? { locale } : {}),
  };
}

/** Route courante, réévaluée quand l'utilisateur navigue avec les boutons du navigateur. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute());

  useEffect(() => {
    const onNavigate = (): void => setRoute(parseRoute());
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);

  return route;
}
