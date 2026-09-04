import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { createCategorySchema, reorderSchema, updateCategorySchema } from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { AppError, notFound } from '../../lib/errors.js';
import { json, owned } from '../../lib/prisma-helpers.js';

/**
 * Catégories de la carte.
 *
 * `DELETE` archive : une catégorie qui disparaîtrait emporterait l'historique des commandes
 * qui la référencent — commandes que le module suivant écrira. On la sort de la carte, on ne
 * l'efface pas.
 */
const categoryRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_READ)],
      schema: {
        tags: ['menu'],
        summary: 'Catégories du restaurant',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          includeArchived: z.coerce.boolean().default(false),
        }),
      },
    },
    scoped(async (request, _reply, db) => {
      const { includeArchived } = request.query as { includeArchived: boolean };
      return db.category.findMany({
        where: includeArchived ? {} : { archivedAt: null },
        orderBy: { position: 'asc' },
        include: { _count: { select: { menuItems: { where: { archivedAt: null } } } } },
      });
    }),
  );

  app.post(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Crée une catégorie',
        security: [{ bearerAuth: [] }],
        body: createCategorySchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const body = request.body as z.infer<typeof createCategorySchema>;

      const last = await db.category.findFirst({ orderBy: { position: 'desc' } });
      const created = await db.category.create({
        data: owned({
          name: json(body.name),
          icon: body.icon ?? null,
          color: body.color ?? null,
          isVisible: body.isVisible,
          position: body.position ?? (last ? last.position + 1 : 0),
        }),
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'category.created',
        entityType: 'Category',
        entityId: created.id,
        after: created as never,
        fields: ['name', 'isVisible', 'position'],
      });

      reply.status(201);
      return created;
    }),
  );

  app.patch(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Modifie une catégorie',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateCategorySchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateCategorySchema>;

      const before = await db.category.findUnique({ where: { id } });
      if (!before) throw notFound('Cette catégorie');

      const updated = await db.category.update({
        where: { id },
        data: {
          ...(body.name ? { name: json(body.name) } : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.isVisible !== undefined ? { isVisible: body.isVisible } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
        },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'category.updated',
        entityType: 'Category',
        entityId: id,
        before: before as never,
        after: updated as never,
        fields: Object.keys(body),
      });

      await app.events.publish('category.updated', {
        restaurantId: auth.restaurantId!,
        categoryId: id,
        userId: auth.userId,
      });

      return updated;
    }),
  );

  app.delete(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Archive une catégorie (aucune suppression réelle)',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const category = await db.category.findUnique({ where: { id } });
      if (!category) throw notFound('Cette catégorie');
      if (category.archivedAt) return category;

      const remaining = await db.menuItem.count({ where: { categoryId: id, archivedAt: null } });
      if (remaining > 0) {
        throw new AppError(
          'CONFLICT',
          `Cette catégorie contient encore ${remaining} plat${remaining > 1 ? 's' : ''}. Déplacez-les ou archivez-les d'abord.`,
        );
      }

      const archived = await db.category.update({
        where: { id },
        data: { archivedAt: new Date(), isVisible: false },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'category.archived',
        entityType: 'Category',
        entityId: id,
        before: { archivedAt: null },
        after: { archivedAt: archived.archivedAt },
        fields: ['archivedAt'],
      });

      await app.events.publish('category.updated', {
        restaurantId: auth.restaurantId!,
        categoryId: id,
        userId: auth.userId,
      });

      return archived;
    }),
  );

  app.post(
    '/reorder',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Réordonne les catégories',
        security: [{ bearerAuth: [] }],
        body: reorderSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { ids } = request.body as z.infer<typeof reorderSchema>;

      // updateMany reste filtré par l'extension : un identifiant étranger ne touchera rien.
      await db.$transaction(
        ids.map((id, position) =>
          db.category.updateMany({ where: { id }, data: { position } }),
        ),
      );

      await app.events.publish('category.updated', {
        restaurantId: auth.restaurantId!,
        categoryId: ids[0]!,
        userId: auth.userId,
      });

      return db.category.findMany({ where: { archivedAt: null }, orderBy: { position: 'asc' } });
    }),
  );
};

export default categoryRoutes;
