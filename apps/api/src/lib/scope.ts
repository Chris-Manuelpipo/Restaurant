import type { FastifyReply, FastifyRequest } from 'fastify';
import { asPlatform, asTenant, type Db } from '../db/index.js';
import { requireRestaurantId, requireAuth } from '../plugins/auth.js';

/**
 * Enveloppe un handler dans le contexte d'accès qui lui revient.
 *
 * C'est le seul endroit où un handler obtient un client Prisma : il ne peut donc pas
 * travailler hors périmètre, même par distraction. Trois portes, et trois seulement.
 */

type Handler<T> = (request: FastifyRequest, reply: FastifyReply, db: Db) => Promise<T>;

/** Le cas courant : tout est filtré sur le restaurant de la session. */
export function scoped<T>(handler: Handler<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<T> => {
    const auth = requireAuth(request);
    const restaurantId = requireRestaurantId(request);
    return asTenant(restaurantId, (db) => handler(request, reply, db), auth.userId);
  };
}

/** Réservé aux routes de la plateforme, protégées par la capacité `platform:manage`. */
export function platformScoped<T>(handler: Handler<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<T> => {
    const auth = requireAuth(request);
    return asPlatform((db) => handler(request, reply, db), auth.userId);
  };
}

/**
 * Un PLATFORM_ADMIN agissant sur un restaurant donné travaille dans le périmètre de
 * **ce** restaurant : il voit ce que verrait son administrateur, ni plus ni moins.
 */
export function tenantScopedAs<T>(restaurantId: string, handler: Handler<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<T> => {
    const auth = requireAuth(request);
    return asTenant(restaurantId, (db) => handler(request, reply, db), auth.userId);
  };
}
