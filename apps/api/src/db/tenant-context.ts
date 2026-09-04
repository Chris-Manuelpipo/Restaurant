import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexte d'accès aux données, propagé par `AsyncLocalStorage` depuis le hook `onRequest`
 * de Fastify jusqu'au fond de la couche Prisma.
 *
 * Trois modes, et trois seulement :
 *  - `tenant`   — le cas normal : toute requête est filtrée sur ce restaurant ;
 *  - `platform` — réservé au PLATFORM_ADMIN, aucun filtre, ouvert explicitement ;
 *  - `system`   — seeds, migrations, tâches internes.
 *
 * Hors de ces trois modes, la couche d'accès **lève**. Il n'existe aucun repli silencieux :
 * une requête sans contexte est un bug, pas une requête sur toute la base.
 */
export type TenantContext =
  | { mode: 'tenant'; restaurantId: string; userId?: string }
  | { mode: 'platform'; userId?: string }
  | { mode: 'system' };

const storage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Exécute `fn` avec le contexte donné. Tout ce qui est `await` à l'intérieur en hérite. */
export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Raccourci le plus utilisé : le restaurant courant, ou une erreur claire. */
export function currentRestaurantId(): string {
  const context = storage.getStore();
  if (!context || context.mode !== 'tenant') {
    throw new TenantContextError(
      "Cette opération exige un contexte restaurant (mode 'tenant').",
    );
  }
  return context.restaurantId;
}

export class TenantContextError extends Error {
  override readonly name = 'TenantContextError';
}
