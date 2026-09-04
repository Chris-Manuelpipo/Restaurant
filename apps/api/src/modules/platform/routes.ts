import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  DEFAULT_MODULES,
  DEFAULT_THEME,
  IMPLEMENTED_MODULES,
  createRestaurantSchema,
  patchPlatformRestaurantSchema,
} from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { platformScoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { generateInviteToken, hashToken, inviteExpiry } from '../../services/tokens.js';
import { AppError, notFound } from '../../lib/errors.js';
import { json } from '../../lib/prisma-helpers.js';

/**
 * Administration de la plateforme.
 *
 * Seul endroit du code où l'on travaille sans filtre de restaurant, et il est gardé par la
 * capacité `platform:manage`, elle-même réservée au PLATFORM_ADMIN.
 *
 * C'est aussi ici que se décide quels modules un restaurant a le droit d'activer : la
 * modularité se règle par une liste, jamais par une branche de code.
 */
const platformRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  app.get(
    '/restaurants',
    {
      onRequest: [app.requires(CAPABILITIES.PLATFORM_MANAGE)],
      schema: {
        tags: ['platform'],
        summary: 'Tous les restaurants de la plateforme',
        security: [{ bearerAuth: [] }],
      },
    },
    platformScoped(async (_request, _reply, db) => {
      const restaurants = await db.restaurant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              menuItems: { where: { archivedAt: null } },
              accessPoints: { where: { revokedAt: null } },
            },
          },
        },
      });
      return restaurants;
    }),
  );

  app.post(
    '/restaurants',
    {
      onRequest: [app.requires(CAPABILITIES.PLATFORM_MANAGE)],
      schema: {
        tags: ['platform'],
        summary: 'Crée un restaurant et invite son administrateur',
        security: [{ bearerAuth: [] }],
        body: createRestaurantSchema,
      },
    },
    platformScoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const body = request.body as z.infer<typeof createRestaurantSchema>;

      const [slugTaken, emailTaken] = await Promise.all([
        db.restaurant.findUnique({ where: { slug: body.slug }, select: { id: true } }),
        db.user.findUnique({ where: { email: body.adminEmail }, select: { id: true } }),
      ]);
      if (slugTaken) throw new AppError('CONFLICT', 'Cette adresse web est déjà utilisée.');
      if (emailTaken) {
        throw new AppError('CONFLICT', 'Cette adresse e-mail est déjà rattachée à un compte.');
      }

      const modules = body.enabledModules ?? [...DEFAULT_MODULES];
      assertModulesImplemented(modules);

      const token = generateInviteToken();

      const restaurant = await db.restaurant.create({
        data: {
          slug: body.slug,
          name: body.name,
          tagline: body.tagline ?? null,
          status: body.status ?? 'TRIAL',
          theme: json({ ...DEFAULT_THEME, ...(body.theme ?? {}) }),
          timezone: body.timezone ?? 'Africa/Douala',
          currency: body.currency ?? 'XAF',
          enabledModules: modules,
          // Une semaine type, modifiable dès la mise en service : mieux vaut sept lignes
          // plausibles qu'un restaurant qui s'affiche fermé le jour de son lancement.
          openingHours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
              dayOfWeek,
              isOpen: true,
              openTime: '11:00',
              closeTime: '22:00',
            })),
          },
          invitations: {
            create: {
              email: body.adminEmail,
              fullName: body.adminFullName,
              role: 'ADMIN',
              tokenHash: hashToken(token),
              expiresAt: inviteExpiry(),
            },
          },
        },
        include: { invitations: true },
      });

      await recordAudit({
        restaurantId: restaurant.id,
        userId: auth.userId,
        action: 'restaurant.created',
        entityType: 'Restaurant',
        entityId: restaurant.id,
        after: { slug: restaurant.slug, name: restaurant.name, status: restaurant.status },
        fields: ['slug', 'name', 'status'],
      });

      reply.status(201);
      return {
        restaurant,
        invitation: {
          email: body.adminEmail,
          expiresAt: restaurant.invitations[0]?.expiresAt.toISOString(),
          // Affiché une seule fois : seul le haché est conservé.
          url: `${app.config.ADMIN_URL}/invitation/${token}`,
        },
      };
    }),
  );

  app.patch(
    '/restaurants/:id',
    {
      onRequest: [app.requires(CAPABILITIES.PLATFORM_MANAGE)],
      schema: {
        tags: ['platform'],
        summary: 'Change le statut ou les modules actifs d’un restaurant',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: patchPlatformRestaurantSchema,
      },
    },
    platformScoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof patchPlatformRestaurantSchema>;

      const before = await db.restaurant.findUnique({ where: { id } });
      if (!before) throw notFound('Ce restaurant');

      if (body.enabledModules) assertModulesImplemented(body.enabledModules);

      const updated = await db.restaurant.update({
        where: { id },
        data: {
          ...(body.status ? { status: body.status } : {}),
          ...(body.enabledModules ? { enabledModules: body.enabledModules } : {}),
        },
      });

      await recordAudit({
        restaurantId: id,
        userId: auth.userId,
        action: body.status ? 'restaurant.status_changed' : 'restaurant.modules_changed',
        entityType: 'Restaurant',
        entityId: id,
        before: { status: before.status, enabledModules: before.enabledModules },
        after: { status: updated.status, enabledModules: updated.enabledModules },
        fields: ['status', 'enabledModules'],
      });

      await app.events.publish('restaurant.updated', {
        restaurantId: id,
        changedFields: Object.keys(body),
        userId: auth.userId,
      });

      return updated;
    }),
  );

  app.post(
    '/restaurants/:id/invite',
    {
      onRequest: [app.requires(CAPABILITIES.PLATFORM_MANAGE)],
      schema: {
        tags: ['platform'],
        summary: 'Réémet une invitation d’administrateur',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: z.object({
          email: z.string().trim().toLowerCase().email(),
          fullName: z.string().trim().min(2).max(80),
        }),
      },
    },
    platformScoped(async (request, reply, db) => {
      const { id } = request.params as { id: string };
      const body = request.body as { email: string; fullName: string };

      const restaurant = await db.restaurant.findUnique({ where: { id } });
      if (!restaurant) throw notFound('Ce restaurant');

      // Une nouvelle invitation périme les précédentes pour cette adresse.
      await db.invitation.updateMany({
        where: { restaurantId: id, email: body.email, acceptedAt: null },
        data: { expiresAt: new Date() },
      });

      const token = generateInviteToken();
      const invitation = await db.invitation.create({
        data: {
          restaurantId: id,
          email: body.email,
          fullName: body.fullName,
          role: 'ADMIN',
          tokenHash: hashToken(token),
          expiresAt: inviteExpiry(),
        },
      });

      reply.status(201);
      return {
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString(),
        url: `${app.config.ADMIN_URL}/invitation/${token}`,
      };
    }),
  );

  /** Catalogue des modules, avec ceux qui sont réellement livrés. */
  app.get(
    '/modules',
    {
      onRequest: [app.requires(CAPABILITIES.PLATFORM_MANAGE)],
      schema: {
        tags: ['platform'],
        summary: 'Modules connus et modules livrés',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => ({ implemented: IMPLEMENTED_MODULES }),
  );
};

/**
 * On refuse d'activer un module qui n'existe pas encore : mieux vaut un message clair
 * qu'une navigation qui promet un écran vide.
 */
function assertModulesImplemented(modules: string[]): void {
  const unknown = modules.filter(
    (module) => !(IMPLEMENTED_MODULES as string[]).includes(module),
  );
  if (unknown.length > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Ces modules ne sont pas encore livrés : ${unknown.join(', ')}.`,
      { unknown, implemented: IMPLEMENTED_MODULES },
    );
  }
}

export default platformRoutes;
