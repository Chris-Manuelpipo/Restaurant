import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@evolyx/shared';
import { env } from '../config/env.js';
import { AppError, forbidden, unauthenticated } from '../lib/errors.js';
import { asSystem } from '../db/index.js';
import { can, moduleAllows, type Capability } from '../domain/permissions.js';
import type { AccessTokenPayload } from '../services/tokens.js';

/**
 * Authentification et autorisation.
 *
 * Le jeton d'accès porte le rôle et le restaurant, mais on ne s'y fie pas aveuglément : à
 * chaque requête, l'utilisateur est relu en base. Un compte désactivé ou un restaurant
 * suspendu doit cesser de fonctionner tout de suite, pas dans un quart d'heure.
 */

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  restaurantId: string | null;
  restaurantStatus: string | null;
  enabledModules: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyInstance {
    /** Exige une session valide. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige une session valide **et** une capacité donnée. */
    requires: (
      capability: Capability,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  const config = env();

  await app.register(cookie, { secret: config.JWT_REFRESH_SECRET });
  await app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { expiresIn: config.ACCESS_TOKEN_TTL },
    // Le rafraîchissement passe par un cookie httpOnly, jamais par l'en-tête.
    cookie: { cookieName: 'unused', signed: false },
  });

  async function loadAuth(request: FastifyRequest): Promise<AuthContext> {
    let payload: AccessTokenPayload;
    try {
      payload = await request.jwtVerify<AccessTokenPayload>();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'FAST_JWT_EXPIRED' || code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        throw new AppError('TOKEN_EXPIRED', 'Votre session a expiré. Reconnectez-vous.');
      }
      throw unauthenticated();
    }

    // Relecture en base : le jeton dit qui prétend être là, la base dit qui l'est encore.
    const user = await asSystem((db) =>
      db.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          restaurantId: true,
          restaurant: { select: { status: true, enabledModules: true } },
        },
      }),
    );

    if (!user) throw unauthenticated();
    if (!user.isActive) {
      throw new AppError('ACCOUNT_DISABLED', 'Ce compte a été désactivé.');
    }
    if (user.restaurant && user.restaurant.status === 'SUSPENDED') {
      throw new AppError(
        'RESTAURANT_SUSPENDED',
        'Ce restaurant est suspendu. Contactez Evolyx pour le réactiver.',
      );
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      restaurantStatus: user.restaurant?.status ?? null,
      enabledModules: user.restaurant?.enabledModules ?? [],
    };
  }

  app.decorate('authenticate', async (request: FastifyRequest) => {
    request.auth = await loadAuth(request);
  });

  app.decorate('requires', (capability: Capability) => {
    return async (request: FastifyRequest) => {
      const auth = request.auth ?? (await loadAuth(request));
      request.auth = auth;

      if (!can(auth.role, capability)) {
        throw forbidden(
          "Votre rôle ne permet pas cette action. Demandez à l'administrateur du restaurant.",
        );
      }

      // Un PLATFORM_ADMIN n'est rattaché à aucun restaurant : pas de module à vérifier.
      if (auth.restaurantId && !moduleAllows(capability, auth.enabledModules)) {
        throw new AppError(
          'MODULE_DISABLED',
          "Ce module n'est pas activé pour votre restaurant.",
        );
      }
    };
  });
});

/** Le restaurant de la session, ou une erreur claire pour un PLATFORM_ADMIN sans restaurant. */
export function requireRestaurantId(request: FastifyRequest): string {
  const id = request.auth?.restaurantId;
  if (!id) {
    throw forbidden(
      "Cette action s'exerce depuis un restaurant. Sélectionnez-en un depuis l'espace plateforme.",
    );
  }
  return id;
}

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthenticated();
  return request.auth;
}
