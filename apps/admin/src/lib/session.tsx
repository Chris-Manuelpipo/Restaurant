import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ModuleKey, SessionResponse } from '@evolyx/shared';
import { api, getAccessToken, subscribeToToken } from './api';

/**
 * Session courante.
 *
 * `/auth/me` fait autorité : rôle, restaurant, modules actifs et capacités. La navigation et
 * les écrans s'en déduisent — jamais d'un test de rôle en dur dans un composant. Ce que le
 * front masque, l'API le refuse de toute façon : les deux lisent la même matrice.
 */

interface SessionContextValue {
  session: SessionResponse | null;
  isLoading: boolean;
  can: (capability: string) => boolean;
  hasModule: (module: ModuleKey) => boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();

  // Le jeton est une source externe : on s'y abonne pour que la session se charge dès
  // qu'une connexion aboutit, sans attendre une navigation.
  const token = useSyncExternalStore(
    subscribeToToken,
    () => getAccessToken(),
    () => null,
  );

  const query = useQuery({
    queryKey: ['session', token],
    queryFn: () => api.get<SessionResponse>('/auth/me'),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Les données d'une session ne doivent jamais s'afficher dans la suivante : sur un poste
  // partagé, la personne qui se connecte après la déconnexion verrait sinon la carte, l'équipe
  // ou le journal du restaurant précédent, tirés du cache. On vide donc tout ce qui n'est pas
  // la session elle-même dès que le jeton disparaît ou que l'utilisateur change.
  const userId = query.data?.user.id ?? null;
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    const changedUser =
      previousUserId.current !== null && userId !== null && previousUserId.current !== userId;
    if (!token || changedUser) {
      queryClient.removeQueries({ predicate: (cached) => cached.queryKey[0] !== 'session' });
    }
    if (!token) previousUserId.current = null;
    else if (userId !== null) previousUserId.current = userId;
  }, [token, userId, queryClient]);

  const value = useMemo<SessionContextValue>(() => {
    const session = query.data ?? null;
    return {
      session,
      isLoading: Boolean(token) && query.isLoading,
      can: (capability) => session?.capabilities.includes(capability) ?? false,
      hasModule: (module) => session?.modules.includes(module) ?? false,
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ['session'] });
      },
    };
  }, [query.data, query.isLoading, queryClient, token]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession doit être utilisé dans un SessionProvider.');
  return context;
}

/** Le restaurant de la session, ou une erreur explicite si on est côté plateforme. */
export function useRestaurant() {
  const { session } = useSession();
  return session?.restaurant ?? null;
}
