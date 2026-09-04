import { PrismaClient } from '@prisma/client';
import { TenantContextError, getTenantContext } from './tenant-context.js';

/* ═══════════════════════════════════════════════════════════════════════════
   Isolation multi-tenant, appliquée à la couche d'accès aux données.

   Aucun handler n'écrit `where: { restaurantId }` à la main : c'est ici, et
   nulle part ailleurs, que la frontière entre restaurants est tenue. Un
   handler qui oublierait le filtre ne peut pas fuiter — il n'a pas les moyens
   de contourner l'extension.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Modèles portant directement `restaurantId`. */
const TENANT_MODELS = new Set([
  'OpeningHours',
  'User',
  'Category',
  'MenuItem',
  'AvailabilityRule',
  'AccessPoint',
  'AuditLog',
  'Invitation',
]);

/**
 * Modèles rattachés au restaurant par leur parent. On les filtre par la relation.
 * Leurs opérations « unitaires » sont refusées en mode tenant : un `update` par id seul
 * n'offre aucune prise pour vérifier l'appartenance. Le code passe par `updateMany`/
 * `deleteMany` (filtrés) ou par une écriture imbriquée depuis le plat parent.
 */
const CHILD_MODELS: Record<string, string> = {
  MenuItemVariant: 'menuItem',
  MenuItemSupplement: 'menuItem',
  MenuItemImage: 'menuItem',
};

/** Opérations dont le `where` accepte des filtres libres. */
const FILTERABLE = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/** Opérations dont le `where` est unique — Prisma accepte des filtres additionnels depuis la v5. */
const UNIQUE_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);

const WRITE_CREATE = new Set(['create', 'createMany', 'createManyAndReturn']);

type AnyArgs = Record<string, unknown>;

function asObject(value: unknown): AnyArgs {
  return value && typeof value === 'object' ? (value as AnyArgs) : {};
}

/**
 * Fusionne le filtre tenant dans un `where` **sans jamais l'écraser** : si l'appelant a
 * déjà posé un `restaurantId` différent, on garde les deux conditions, ce qui donne un
 * ensemble vide. Une tentative de traversée renvoie « introuvable », pas une erreur qui
 * confirmerait l'existence de la donnée.
 */
function mergeTenantFilter(where: unknown, field: string, value: unknown): AnyArgs {
  const current = asObject(where);
  if (field in current && current[field] !== value) {
    return { AND: [current, { [field]: value }] };
  }
  return { ...current, [field]: value };
}

function mergeRelationFilter(where: unknown, relation: string, restaurantId: string): AnyArgs {
  const current = asObject(where);
  const existing = current[relation];
  if (existing !== undefined) {
    return { AND: [current, { [relation]: { restaurantId } }] };
  }
  return { ...current, [relation]: { restaurantId } };
}

export function createPrismaClient(databaseUrl?: string) {
  const base = new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log:
      process.env.PRISMA_LOG === 'query'
        ? [{ emit: 'stdout', level: 'query' }]
        : [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }],
  });

  return base
    /* ── Frontière entre restaurants ──────────────────────────────────────── */
    .$extends({
      name: 'tenant-isolation',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = getTenantContext();

            if (!context) {
              throw new TenantContextError(
                `Requête « ${model}.${operation} » émise hors de tout contexte d'accès. ` +
                  'Enveloppez-la dans runWithTenantContext(), ou utilisez db.system() pour une tâche interne.',
              );
            }

            // Le PLATFORM_ADMIN et les tâches système travaillent sans filtre, explicitement.
            if (context.mode !== 'tenant') return query(args);

            const { restaurantId } = context;
            const mutable = args as AnyArgs;

            /* Le restaurant lui-même : la frontière porte sur sa clé primaire. */
            if (model === 'Restaurant') {
              if (FILTERABLE.has(operation) || UNIQUE_WHERE.has(operation)) {
                mutable.where = mergeTenantFilter(mutable.where, 'id', restaurantId);
                return query(args);
              }
              if (WRITE_CREATE.has(operation)) {
                throw new TenantContextError(
                  "Créer un restaurant relève de la plateforme, pas d'un restaurant.",
                );
              }
              return query(args);
            }

            /* Entités portant restaurantId. */
            if (TENANT_MODELS.has(model)) {
              if (FILTERABLE.has(operation) || UNIQUE_WHERE.has(operation)) {
                mutable.where = mergeTenantFilter(mutable.where, 'restaurantId', restaurantId);
              }
              if (operation === 'create' || operation === 'upsert') {
                const key = operation === 'create' ? 'data' : 'create';
                mutable[key] = { ...asObject(mutable[key]), restaurantId };
              }
              if (operation === 'update' || operation === 'upsert') {
                // On ne laisse pas une mise à jour déplacer une ligne vers un autre restaurant.
                const key = operation === 'update' ? 'data' : 'update';
                const data = asObject(mutable[key]);
                if ('restaurantId' in data) {
                  const { restaurantId: _ignored, ...rest } = data;
                  mutable[key] = rest;
                }
              }
              if (operation === 'createMany' || operation === 'createManyAndReturn') {
                const rows = mutable.data;
                mutable.data = Array.isArray(rows)
                  ? rows.map((row) => ({ ...asObject(row), restaurantId }))
                  : { ...asObject(rows), restaurantId };
              }
              return query(args);
            }

            /* Entités filles : filtrées par leur parent. */
            const relation = CHILD_MODELS[model];
            if (relation) {
              if (FILTERABLE.has(operation)) {
                mutable.where = mergeRelationFilter(mutable.where, relation, restaurantId);
                return query(args);
              }
              if (UNIQUE_WHERE.has(operation) || WRITE_CREATE.has(operation)) {
                throw new TenantContextError(
                  `« ${model}.${operation} » n'est pas isolable par identifiant seul. ` +
                    'Passez par une écriture imbriquée depuis le plat, ou par updateMany/deleteMany.',
                );
              }
              return query(args);
            }

            /* Modèles hors périmètre tenant (RefreshToken) : réservés au mode système. */
            throw new TenantContextError(
              `« ${model} » ne s'utilise pas dans un contexte restaurant. Utilisez db.system().`,
            );
          },
        },
      },
    });
}

export type Db = ReturnType<typeof createPrismaClient>;

let singleton: Db | undefined;

/** Client partagé par le processus. Une seule pool de connexions, quel que soit le module. */
export function getDb(): Db {
  if (!singleton) singleton = createPrismaClient();
  return singleton;
}

export async function disconnectDb(): Promise<void> {
  if (singleton) {
    await singleton.$disconnect();
    singleton = undefined;
  }
}
