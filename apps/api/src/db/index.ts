import { getDb, type Db } from './client.js';
import { runWithTenantContext, type TenantContext } from './tenant-context.js';

export { getDb, disconnectDb, createPrismaClient, type Db } from './client.js';
export {
  currentRestaurantId,
  getTenantContext,
  runWithTenantContext,
  TenantContextError,
  type TenantContext,
} from './tenant-context.js';

/**
 * Les requêtes Prisma sont paresseuses : elles ne partent qu'au premier `await`. On attend
 * donc **à l'intérieur** du contexte — sinon le `then` serait déclenché par l'appelant, hors
 * du store, et l'extension refuserait la requête. Ce `await` n'est pas décoratif.
 */
async function run<T>(context: TenantContext, fn: (db: Db) => Promise<T> | T): Promise<T> {
  return runWithTenantContext(context, async () => await fn(getDb()));
}

/** Exécute un bloc dans le périmètre d'un restaurant. */
export function asTenant<T>(
  restaurantId: string,
  fn: (db: Db) => Promise<T> | T,
  userId?: string,
): Promise<T> {
  return run({ mode: 'tenant', restaurantId, ...(userId ? { userId } : {}) }, fn);
}

/** Exécute un bloc sans filtre, pour un PLATFORM_ADMIN. À n'ouvrir que sur ses routes. */
export function asPlatform<T>(fn: (db: Db) => Promise<T> | T, userId?: string): Promise<T> {
  return run({ mode: 'platform', ...(userId ? { userId } : {}) }, fn);
}

/** Exécute un bloc en mode système : seeds, migrations, authentification, tâches internes. */
export function asSystem<T>(fn: (db: Db) => Promise<T> | T): Promise<T> {
  return run({ mode: 'system' }, fn);
}
