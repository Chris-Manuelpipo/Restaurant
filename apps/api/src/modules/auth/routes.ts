import { z } from 'zod';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { acceptInviteSchema, loginSchema, type ModuleKey } from '@evolyx/shared';
import { asSystem } from '../../db/index.js';
import { AppError, notFound } from '../../lib/errors.js';
import { capabilitiesFor } from '../../domain/permissions.js';
import { hashPassword, verifyPassword } from '../../services/password.js';
import {
  REFRESH_COOKIE,
  consumeRefreshToken,
  hashToken,
  issueRefreshToken,
  revokeRefreshToken,
} from '../../services/tokens.js';
import { requireAuth } from '../../plugins/auth.js';

/**
 * Sessions.
 *
 * Le jeton d'accès (15 min) part dans le corps de la réponse ; le rafraîchissement (7 j) dans
 * un cookie `httpOnly`. Aucune réponse d'erreur ne distingue « e-mail inconnu » de « mot de
 * passe faux » : cela reviendrait à offrir un annuaire des comptes existants.
 */
const authRoutes: FastifyPluginAsync = async (app) => {
  const config = app.config;

  function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.COOKIE_SECURE,
      path: '/api/v1/auth',
      expires: expiresAt,
      ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
    });
  }

  app.post(
    '/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Ouvre une session',
        body: loginSchema,
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as z.infer<typeof loginSchema>;

      const user = await asSystem((db) =>
        db.user.findUnique({
          where: { email },
          include: { restaurant: { select: { status: true } } },
        }),
      );

      const ok = user ? await verifyPassword(user.passwordHash, password) : false;
      if (!user || !ok) {
        throw new AppError('INVALID_CREDENTIALS', 'Adresse e-mail ou mot de passe incorrect.');
      }
      if (!user.isActive) {
        throw new AppError('ACCOUNT_DISABLED', 'Ce compte a été désactivé.');
      }
      if (user.restaurant?.status === 'SUSPENDED') {
        throw new AppError(
          'RESTAURANT_SUSPENDED',
          'Ce restaurant est suspendu. Contactez Evolyx pour le réactiver.',
        );
      }

      await asSystem((db) =>
        db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      );

      const accessToken = app.jwt.sign({
        sub: user.id,
        role: user.role,
        restaurantId: user.restaurantId,
        email: user.email,
      });
      const refresh = await issueRefreshToken(user.id);
      setRefreshCookie(reply, refresh.token, refresh.expiresAt);

      return { accessToken, expiresIn: config.ACCESS_TOKEN_TTL };
    },
  );

  app.post(
    '/refresh',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { tags: ['auth'], summary: 'Renouvelle le jeton d’accès' },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) throw new AppError('UNAUTHENTICATED', 'Session absente. Reconnectez-vous.');

      const consumed = await consumeRefreshToken(token);
      if (!consumed) {
        reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
        throw new AppError('UNAUTHENTICATED', 'Session expirée. Reconnectez-vous.');
      }

      const user = await asSystem((db) => db.user.findUnique({ where: { id: consumed.userId } }));
      if (!user || !user.isActive) {
        reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
        throw new AppError('UNAUTHENTICATED', 'Session expirée. Reconnectez-vous.');
      }

      const accessToken = app.jwt.sign({
        sub: user.id,
        role: user.role,
        restaurantId: user.restaurantId,
        email: user.email,
      });
      const refresh = await issueRefreshToken(user.id);
      setRefreshCookie(reply, refresh.token, refresh.expiresAt);

      return { accessToken, expiresIn: config.ACCESS_TOKEN_TTL };
    },
  );

  app.post(
    '/logout',
    { schema: { tags: ['auth'], summary: 'Ferme la session' } },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) await revokeRefreshToken(token);
      reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      return { ok: true };
    },
  );

  /* ── Qui suis-je, et que puis-je faire ─────────────────────────────────── */
  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Utilisateur courant, restaurant et modules actifs',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const auth = requireAuth(request);

      const user = await asSystem((db) =>
        db.user.findUniqueOrThrow({
          where: { id: auth.userId },
          include: {
            restaurant: {
              select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                logoUrl: true,
                theme: true,
                currency: true,
                timezone: true,
                defaultLocale: true,
                enabledLocales: true,
                enabledModules: true,
                onboardingStep: true,
                onboardingCompletedAt: true,
              },
            },
          },
        }),
      );

      const modules = (user.restaurant?.enabledModules ?? []) as ModuleKey[];

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          restaurantId: user.restaurantId,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        },
        restaurant: user.restaurant
          ? {
              ...user.restaurant,
              onboardingCompletedAt: user.restaurant.onboardingCompletedAt?.toISOString() ?? null,
            }
          : null,
        modules,
        capabilities: capabilitiesFor(user.role, modules),
      };
    },
  );

  /* ── Prise de possession d'un compte invité ────────────────────────────── */
  app.get(
    '/invite/:token',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Vérifie un lien d’invitation',
        params: z.object({ token: z.string().min(20).max(400) }),
      },
    },
    async (request) => {
      const { token } = request.params as { token: string };
      const invitation = await findInvitation(token);
      return {
        email: invitation.email,
        fullName: invitation.fullName,
        restaurantName: invitation.restaurant.name,
        role: invitation.role,
      };
    },
  );

  app.post(
    '/invite/accept',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Définit le mot de passe et active le compte',
        body: acceptInviteSchema,
      },
    },
    async (request, reply) => {
      const { token, password, fullName } = request.body as z.infer<typeof acceptInviteSchema>;
      const invitation = await findInvitation(token);

      const user = await asSystem(async (db) => {
        const passwordHash = await hashPassword(password);
        const created = await db.user.upsert({
          where: { email: invitation.email },
          create: {
            email: invitation.email,
            passwordHash,
            fullName: fullName ?? invitation.fullName,
            role: invitation.role,
            restaurantId: invitation.restaurantId,
            isActive: true,
          },
          update: {
            passwordHash,
            isActive: true,
            ...(fullName ? { fullName } : {}),
          },
        });

        await db.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        return created;
      });

      const accessToken = app.jwt.sign({
        sub: user.id,
        role: user.role,
        restaurantId: user.restaurantId,
        email: user.email,
      });
      const refresh = await issueRefreshToken(user.id);
      setRefreshCookie(reply, refresh.token, refresh.expiresAt);

      return { accessToken, expiresIn: config.ACCESS_TOKEN_TTL };
    },
  );
};

async function findInvitation(token: string) {
  const invitation = await asSystem((db) =>
    db.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { restaurant: { select: { name: true, status: true } } },
    }),
  );

  if (!invitation) throw notFound('Cette invitation');
  if (invitation.acceptedAt !== null) {
    throw new AppError('CONFLICT', 'Cette invitation a déjà été utilisée.');
  }
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new AppError('CONFLICT', 'Cette invitation a expiré. Demandez-en une nouvelle.');
  }
  return invitation;
}

export default authRoutes;
