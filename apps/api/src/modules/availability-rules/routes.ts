import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { RULE_KINDS, createRuleSchema, updateRuleSchema, type RuleKind } from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { notFound } from '../../lib/errors.js';
import { jsonOrNull, owned } from '../../lib/prisma-helpers.js';

/**
 * Règles de disponibilité.
 *
 * Trois usages, un seul modèle : n'afficher que pendant le créneau (`VISIBILITY` — le brunch
 * du dimanche), masquer pendant le créneau (`HIDE` — pas de grillades le dimanche midi) ou
 * signaler une promotion (`PROMO` — l'happy hour). `discountPercent` est informatif au
 * lot 1 : il est stocké, affiché, mais aucun calcul ne s'appuie dessus tant que la Caisse
 * n'existe pas.
 */
const ruleRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.RULES_READ)],
      schema: {
        tags: ['menu'],
        summary: 'Règles de disponibilité et promotions',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          kind: z.enum(RULE_KINDS).optional(),
          targetId: z.string().optional(),
        }),
      },
    },
    scoped(async (request, _reply, db) => {
      const { kind, targetId } = request.query as { kind?: RuleKind; targetId?: string };
      return db.availabilityRule.findMany({
        where: { ...(kind ? { kind } : {}), ...(targetId ? { targetId } : {}) },
        orderBy: { createdAt: 'asc' },
      });
    }),
  );

  app.post(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.RULES_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Crée une règle',
        security: [{ bearerAuth: [] }],
        body: createRuleSchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const body = request.body as z.infer<typeof createRuleSchema>;

      // La cible doit exister et appartenir au restaurant — l'extension s'en assure.
      const target =
        body.targetType === 'CATEGORY'
          ? await db.category.findUnique({ where: { id: body.targetId } })
          : await db.menuItem.findUnique({ where: { id: body.targetId } });
      if (!target) throw notFound(body.targetType === 'CATEGORY' ? 'Cette catégorie' : 'Ce plat');

      const created = await db.availabilityRule.create({
        data: owned({
          targetType: body.targetType,
          targetId: body.targetId,
          kind: body.kind,
          daysOfWeek: body.daysOfWeek,
          startTime: body.startTime,
          endTime: body.endTime,
          label: jsonOrNull(body.label),
          discountPercent: body.discountPercent ?? null,
        }),
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'rule.created',
        entityType: 'AvailabilityRule',
        entityId: created.id,
        after: created as never,
        fields: ['kind', 'targetType', 'targetId', 'daysOfWeek', 'startTime', 'endTime'],
      });

      await app.events.publish('availability_rule.changed', {
        restaurantId: auth.restaurantId!,
        ruleId: created.id,
        userId: auth.userId,
      });

      reply.status(201);
      return created;
    }),
  );

  app.patch(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.RULES_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Modifie une règle',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateRuleSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateRuleSchema>;

      const before = await db.availabilityRule.findUnique({ where: { id } });
      if (!before) throw notFound('Cette règle');

      const updated = await db.availabilityRule.update({
        where: { id },
        data: {
          ...(body.daysOfWeek ? { daysOfWeek: body.daysOfWeek } : {}),
          ...(body.startTime ? { startTime: body.startTime } : {}),
          ...(body.endTime ? { endTime: body.endTime } : {}),
          ...(body.label !== undefined ? { label: jsonOrNull(body.label) } : {}),
          ...(body.discountPercent !== undefined ? { discountPercent: body.discountPercent } : {}),
        },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'rule.updated',
        entityType: 'AvailabilityRule',
        entityId: id,
        before: before as never,
        after: updated as never,
        fields: Object.keys(body),
      });

      await app.events.publish('availability_rule.changed', {
        restaurantId: auth.restaurantId!,
        ruleId: id,
        userId: auth.userId,
      });

      return updated;
    }),
  );

  app.delete(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.RULES_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Supprime une règle',
        description:
          "Une règle n'est pas une donnée d'historique : elle décrit un comportement présent. " +
          'Sa suppression est donc réelle, contrairement aux plats et aux catégories.',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const before = await db.availabilityRule.findUnique({ where: { id } });
      if (!before) throw notFound('Cette règle');

      await db.availabilityRule.deleteMany({ where: { id } });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'rule.deleted',
        entityType: 'AvailabilityRule',
        entityId: id,
        before: before as never,
        after: null,
        fields: ['kind', 'targetId', 'startTime', 'endTime'],
      });

      await app.events.publish('availability_rule.changed', {
        restaurantId: auth.restaurantId!,
        ruleId: id,
        userId: auth.userId,
      });

      return { ok: true };
    }),
  );
};

export default ruleRoutes;
