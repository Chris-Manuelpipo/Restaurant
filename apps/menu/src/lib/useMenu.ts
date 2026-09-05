import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicMenuResponse } from '@evolyx/shared';
import { fetchMenu, readSnapshot, saveSnapshot } from './api';

/**
 * Chargement du menu.
 *
 * Une seule requête, un seul état. Un gestionnaire de cache complet apporterait ici des
 * mécanismes dont le menu n'a pas l'usage — mutations, invalidations croisées, requêtes
 * dépendantes — pour treize kilo-octets transférés, sur une page dont tout l'enjeu est
 * d'apparaître vite. Le back-office, lui, garde TanStack Query : il a des dizaines de
 * requêtes qui s'invalident les unes les autres.
 *
 * Ce que ce hook tient, et qui suffit :
 *  - la dernière carte connue s'affiche **avant** la réponse réseau ;
 *  - un retour d'onglet ou de réseau relance la requête ;
 *  - l'échec ne fait jamais disparaître la carte déjà affichée.
 */

export interface MenuState {
  data: PublicMenuResponse | undefined;
  isLoading: boolean;
  error: unknown;
  /** Vrai quand la carte affichée ne vient pas de cette requête-ci. */
  isStaleData: boolean;
  refetch: () => void;
}

const REFRESH_AFTER_MS = 60_000;

export function useMenu(slug: string, locale: string | undefined): MenuState {
  const key = locale ?? 'default';
  const snapshot = useRef(readSnapshot(slug, key));

  const [data, setData] = useState<PublicMenuResponse | undefined>(snapshot.current?.payload);
  const [isLoading, setIsLoading] = useState(!snapshot.current);
  const [error, setError] = useState<unknown>(null);
  const [fromNetwork, setFromNetwork] = useState(false);

  const lastFetch = useRef(0);
  const alive = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    lastFetch.current = Date.now();
    try {
      const payload = await fetchMenu(slug, locale);
      if (!alive.current) return;
      setData(payload);
      setFromNetwork(true);
      setError(null);
      saveSnapshot(slug, key, payload);
    } catch (cause) {
      if (!alive.current) return;
      // On garde la carte affichée : une carte de la veille vaut mieux qu'une page vide.
      setError(cause);
    } finally {
      if (alive.current) setIsLoading(false);
    }
  }, [slug, locale, key]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  /* Retour sur l'onglet ou retour du réseau : on revérifie, sans harceler le serveur. */
  useEffect(() => {
    const maybeRefresh = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetch.current < REFRESH_AFTER_MS) return;
      void load();
    };

    document.addEventListener('visibilitychange', maybeRefresh);
    window.addEventListener('online', maybeRefresh);
    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh);
      window.removeEventListener('online', maybeRefresh);
    };
  }, [load]);

  return {
    data,
    isLoading,
    error,
    isStaleData: Boolean(data) && !fromNetwork,
    refetch: () => void load(),
  };
}
