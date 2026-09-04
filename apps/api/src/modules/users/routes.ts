import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { createUserSchema, updateUserSchema } from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { hashPassword } from '../../services/password.js';
import { generateInviteToken, hashToken, inviteExpiry, revokeAllUserTokens } from '../../services/tokens.js';
import { asSystem } from '../../db/index.js';
import { AppError, notFound } from '../../lib/errors.js';
import { owned } from '../../lib/prisma-helpers.js';

/**
 * Comptes du restaurant.
 *
 * Réservés à l'ADMIN. Un compte ne se supprime pas : il se désactive — ses actions restent
 * attribuées dans le journal d'audit, et c'est bien l'intérêt du journal.
 *
 * Deux façons de créer un compte : avec un mot de passe fourni (le gérant crée le compte
 * d'un serveur et lui dit son mot de passe de vive voix), ou par invitation (l'intéressé
 * choisit lui-même son mot de passe).
 */
const userRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  const publicFields = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
  } as const;

  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.USERS_READ)],
      schema: {
        tags: ['users'],
        summary: 'Comptes du restaurant',
        security: [{ bearerAuth: [] }],
      },
    },
    scoped(async (_request, _reply, db) =>
      db.user.findMany({ select: publicFields, orderBy: { createdAt: 'asc' } }),
    ),
  );

  app.post(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.USERS_WRITE)],
      schema: {
        tags: ['users'],
        summary: 'Crée un compte, avec mot de passe ou par invitation',
        security: [{ bearerAuth: [] }],
        body: createUserSchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const body = request.body as z.infer<typeof createUserSchema>;

      // L'unicité de l'e-mail est globale : la vérification passe donc en mode système.
      const taken = await asSystem((system) =>
        system.user.findUnique({ where: { email: body.email }, select: { id: true } }),
      );
      if (taken) throw new AppError('CONFLICT', 'Cette adresse e-mail est déjà utilisée.');

      if (body.password) {
        const created = await db.user.create({
          data: owned({
            email: body.email,
            fullName: body.fullName,
            role: body.role,
            passwordHash: await hashPassword(body.password),
            isActive: true,
          }),
          select: publicFields,
        });

        await recordAudit({
          restaurantId: auth.restaurantId,
          userId: auth.userId,
          action: 'user.created',
          entityType: 'User',
          entityId: created.id,
          after: { email: created.email, role: created.role },
          fields: ['email', 'role'],
        });

        await app.events.publish('user.created', {
          restaurantId: auth.restaurantId!,
          userId: created.id,
          role: created.role,
          actorId: auth.userId,
        });

        reply.status(201);
        return { user: created, invitation: null };
      }

      const token = generateInviteToken();
      const invitation = await db.invitation.create({
        data: owned({
          email: body.email,
          fullName: body.fullName,
          role: body.role,
          tokenHash: hashToken(token),
          expiresAt: inviteExpiry(),
        }),
      });

      reply.status(201);
      return {
        user: null,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt.toISOString(),
          // Le lien est renvoyé une seule fois : il n'est stocké que haché.
          url: `${app.config.ADMIN_URL}/invitation/${token}`,
        },
      };
    }),
  );

  app.patch(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.USERS_WRITE)],
      schema: {
        tags: ['users'],
        summary: 'Modifie un compte',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateUserSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateUserSchema>;

      const before = await db.user.findUnique({ where: { id }, select: publicFields });
      if (!before) throw notFound('Ce compte');

      if (id === auth.userId && body.isActive === false) {
        throw new AppError('CONFLICT', 'Vous ne pouvez pas désactiver votre propre compte.');
      }
      if (id === auth.userId && body.role && body.role !== before.role) {
        throw new AppError('CONFLICT', 'Vous ne pouvez pas changer votre propre rôle.');
      }

      const updated = await db.user.update({
        where: { id },
        data: {
          ...(body.fullName ? { fullName: body.fullName } : {}),
          ...(body.role ? { role: body.role } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
        },
        select: publicFields,
      });

      // Changement de mot de passe ou désactivation : toutes les sessions tombent.
      if (body.password || body.isActive === false) {
        await revokeAllUserTokens(id);
      }

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: body.isActive === false ? 'user.deactivated' : 'user.updated',
        entityType: 'User',
        entityId: id,
        before: before as never,
        after: updated as never,
        fields: Object.keys(body).filter((key) => key !== 'password'),
      });

      if (body.isActive === false) {
        await app.events.publish('user.deactivated', {
          restaurantId: auth.restaurantId!,
          userId: id,
          actorId: auth.userId,
        });
      }

      return updated;
    }),
  );

  app.delete(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.USERS_WRITE)],
      schema: {
        tags: ['users'],
        summary: 'Désactive un compte (aucune suppression réelle)',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      if (id === auth.userId) {
        throw new AppError('CONFLICT', 'Vous ne pouvez pas désactiver votre propre compte.');
      }

      const user = await db.user.findUnique({ where: { id }, select: publicFields });
      if (!user) throw notFound('Ce compte');

      const updated = await db.user.update({
        where: { id },
        data: { isActive: false },
        select: publicFields,
      });
      await revokeAllUserTokens(id);

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'user.deactivated',
        entityType: 'User',
        entityId: id,
        before: { isActive: true },
        after: { isActive: false },
        fields: ['isActive'],
      });

      await app.events.publish('user.deactivated', {
        restaurantId: auth.restaurantId!,
        userId: id,
        actorId: auth.userId,
      });

      return updated;
    }),
  );
};

export default userRoutes;
