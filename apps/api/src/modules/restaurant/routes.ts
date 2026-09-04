import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { deriveTheme, updateRestaurantSchema } from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { processCover, processLogo } from '../../services/images.js';
import { AppError } from '../../lib/errors.js';
import { asTheme, json } from '../../lib/prisma-helpers.js';

/**
 * Identité, charte et horaires du restaurant.
 *
 * La charte appartient au restaurant : on l'enregistre telle qu'elle est saisie, y compris
 * quand le contraste est médiocre. L'interface avertit, l'API n'interdit pas — mais elle
 * renvoie systématiquement les avertissements calculés, pour que le back-office les affiche
 * et que le gérant décide en connaissance de cause.
 */
const restaurantRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.RESTAURANT_READ)],
      schema: {
        tags: ['restaurant'],
        summary: 'Fiche complète du restaurant',
        security: [{ bearerAuth: [] }],
      },
    },
    scoped(async (request, _reply, db) => {
      const restaurantId = requireAuth(request).restaurantId!;
      const restaurant = await db.restaurant.findUniqueOrThrow({
        where: { id: restaurantId },
        include: { openingHours: { orderBy: { dayOfWeek: 'asc' } } },
      });

      const theme = deriveTheme(asTheme(restaurant.theme));
      return {
        ...restaurant,
        themePreview: { vars: theme.vars, contrast: theme.contrast, warnings: theme.warnings },
      };
    }),
  );

  app.patch(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.RESTAURANT_WRITE)],
      schema: {
        tags: ['restaurant'],
        summary: 'Met à jour identité, charte, coordonnées et horaires',
        security: [{ bearerAuth: [] }],
        body: updateRestaurantSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const restaurantId = auth.restaurantId!;
      const body = request.body as z.infer<typeof updateRestaurantSchema>;
      const { openingHours, ...fields } = body;

      const before = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });

      if (fields.slug && fields.slug !== before.slug) {
        const taken = await db.restaurant.findFirst({ where: { slug: fields.slug } });
        // L'extension multi-tenant filtre sur l'id : un slug pris ailleurs remonte par la contrainte.
        if (taken && taken.id !== restaurantId) {
          throw new AppError('CONFLICT', 'Cette adresse web est déjà utilisée.');
        }
      }

      const updated = await db.restaurant.update({
        where: { id: restaurantId },
        data: {
          ...fields,
          ...(fields.theme ? { theme: json(fields.theme) } : {}),
          ...(fields.socials ? { socials: json(fields.socials) } : {}),
        },
        include: { openingHours: { orderBy: { dayOfWeek: 'asc' } } },
      });

      if (openingHours) {
        // Sept lignes au plus, une par jour : on remplace, c'est plus simple à raisonner
        // qu'une réconciliation partielle, et le volume est dérisoire.
        await db.openingHours.deleteMany({});
        await db.openingHours.createMany({
          data: openingHours.map((day) => ({ ...day, restaurantId })),
        });
      }

      const changedFields = Object.keys(fields);
      if (changedFields.length > 0) {
        await recordAudit({
          restaurantId,
          userId: auth.userId,
          action: fields.theme ? 'theme.updated' : 'restaurant.updated',
          entityType: 'Restaurant',
          entityId: restaurantId,
          before: before as never,
          after: updated as never,
          fields: changedFields,
        });
      }
      if (openingHours) {
        await recordAudit({
          restaurantId,
          userId: auth.userId,
          action: 'restaurant.updated',
          entityType: 'OpeningHours',
          entityId: restaurantId,
          before: { openingHours: before ? undefined : null },
          after: { openingHours },
          fields: ['openingHours'],
        });
      }

      await app.events.publish('restaurant.updated', {
        restaurantId,
        changedFields: [...changedFields, ...(openingHours ? ['openingHours'] : [])],
        userId: auth.userId,
      });

      const fresh = await db.restaurant.findUniqueOrThrow({
        where: { id: restaurantId },
        include: { openingHours: { orderBy: { dayOfWeek: 'asc' } } },
      });
      const theme = deriveTheme(asTheme(fresh.theme));

      return {
        ...fresh,
        themePreview: { vars: theme.vars, contrast: theme.contrast, warnings: theme.warnings },
      };
    }),
  );

  /* ── Progression de la mise en service ─────────────────────────────────── */
  app.post(
    '/onboarding',
    {
      onRequest: [app.requires(CAPABILITIES.RESTAURANT_WRITE)],
      schema: {
        tags: ['restaurant'],
        summary: 'Enregistre l’avancement de la mise en service',
        security: [{ bearerAuth: [] }],
        body: z.object({
          step: z.number().int().min(0).max(5),
          complete: z.boolean().optional(),
        }),
      },
    },
    scoped(async (request, _reply, db) => {
      const restaurantId = requireAuth(request).restaurantId!;
      const { step, complete } = request.body as { step: number; complete?: boolean };

      const updated = await db.restaurant.update({
        where: { id: restaurantId },
        data: {
          onboardingStep: step,
          ...(complete
            ? { onboardingCompletedAt: new Date(), status: 'ACTIVE' as const }
            : {}),
        },
        select: { onboardingStep: true, onboardingCompletedAt: true, status: true },
      });

      return updated;
    }),
  );

  /* ── Logo et couverture ────────────────────────────────────────────────── */
  app.post(
    '/logo',
    {
      onRequest: [app.requires(CAPABILITIES.RESTAURANT_WRITE)],
      schema: {
        tags: ['restaurant'],
        summary: 'Envoie le logo (multipart)',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
    },
    scoped(async (request, _reply, db) => {
      const restaurantId = requireAuth(request).restaurantId!;
      const file = await request.file();
      if (!file) throw new AppError('VALIDATION_ERROR', 'Aucun fichier reçu.');

      const buffer = await file.toBuffer();
      const { url } = await processLogo(buffer, file.mimetype, restaurantId);

      await db.restaurant.update({ where: { id: restaurantId }, data: { logoUrl: url } });
      await app.events.publish('restaurant.updated', {
        restaurantId,
        changedFields: ['logoUrl'],
        userId: requireAuth(request).userId,
      });

      return { logoUrl: url };
    }),
  );

  app.post(
    '/cover',
    {
      onRequest: [app.requires(CAPABILITIES.RESTAURANT_WRITE)],
      schema: {
        tags: ['restaurant'],
        summary: 'Envoie la photo de couverture (multipart)',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
    },
    scoped(async (request, _reply, db) => {
      const restaurantId = requireAuth(request).restaurantId!;
      const file = await request.file();
      if (!file) throw new AppError('VALIDATION_ERROR', 'Aucun fichier reçu.');

      const buffer = await file.toBuffer();
      const { url } = await processCover(buffer, file.mimetype, restaurantId);

      await db.restaurant.update({
        where: { id: restaurantId },
        data: { coverUrl: url, coverPreset: null },
      });
      await app.events.publish('restaurant.updated', {
        restaurantId,
        changedFields: ['coverUrl'],
        userId: requireAuth(request).userId,
      });

      return { coverUrl: url };
    }),
  );

  /* ── Journal ───────────────────────────────────────────────────────────── */
  app.get(
    '/audit',
    {
      onRequest: [app.requires(CAPABILITIES.AUDIT_READ)],
      schema: {
        tags: ['restaurant'],
        summary: 'Dernières actions journalisées',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
      },
    },
    scoped(async (request, _reply, db) => {
      const { limit } = request.query as { limit: number };
      const entries = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { fullName: true } } },
      });

      return entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userName: entry.user?.fullName ?? null,
        createdAt: entry.createdAt.toISOString(),
        diff: entry.diff,
      }));
    }),
  );
};

export default restaurantRoutes;
