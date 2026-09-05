import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  accessPointPdfQuerySchema,
  createAccessPointsSchema,
  updateAccessPointSchema,
  type AccessPointKind,
} from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { generateAccessCode } from '../../domain/access-code.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { buildAccessPointsPdf } from '../../services/pdf.js';
import { generateQrPng, generateQrSvg } from '../../services/qr.js';
import { getStorage } from '../../services/storage.js';
import { accessPointUrl, menuUrlFor } from '../../config/env.js';
import { AppError, notFound } from '../../lib/errors.js';
import { asTheme, owned } from '../../lib/prisma-helpers.js';

/**
 * Points d'accès — les codes QR posés sur les tables.
 *
 * Le code est tiré une fois, à la création, et ne change **jamais** : c'est la promesse faite
 * au restaurateur qui plastifie ses chevalets. Ce qui change, c'est le libellé (« Table 3 »
 * devient « Table 7 ») et l'activation. Réaffecter une table ne réimprime rien.
 */
const accessPointRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  /** Trois tentatives suffisent : l'espace de codes est immense, la contrainte fait foi. */
  async function createWithUniqueCode(
    db: Parameters<Parameters<typeof scoped>[0]>[2],
    data: { kind: string; label: string },
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await db.accessPoint.create({
          data: owned({
            code: generateAccessCode(),
            kind: data.kind as AccessPointKind,
            label: data.label,
          }),
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'P2002') throw error;
      }
    }
    throw new AppError('INTERNAL_ERROR', 'Impossible de générer un code unique. Réessayez.');
  }

  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_READ)],
      schema: {
        tags: ['access-points'],
        summary: 'Points d’accès du restaurant',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ includeRevoked: z.coerce.boolean().default(false) }),
      },
    },
    scoped(async (request, _reply, db) => {
      const { includeRevoked } = request.query as { includeRevoked: boolean };
      const points = await db.accessPoint.findMany({
        where: includeRevoked ? {} : { revokedAt: null },
        orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      });

      return points.map((point) => ({
        ...point,
        url: accessPointUrl(point.code, app.config),
      }));
    }),
  );

  app.post(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_WRITE)],
      schema: {
        tags: ['access-points'],
        summary: 'Crée un ou plusieurs points d’accès',
        description:
          'La création en lot est le geste normal d’une mise en service : « 20 tables » ' +
          'produit Table 1 … Table 20, chacune avec son code définitif.',
        security: [{ bearerAuth: [] }],
        body: createAccessPointsSchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const { kind, label, quantity, startAt } = request.body as z.infer<
        typeof createAccessPointsSchema
      >;

      const created = [];
      for (let index = 0; index < quantity; index += 1) {
        const finalLabel = quantity === 1 ? label : `${label} ${startAt + index}`;
        created.push(await createWithUniqueCode(db, { kind, label: finalLabel }));
      }

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'access_point.created',
        entityType: 'AccessPoint',
        entityId: created[0]?.id ?? 'batch',
        after: { count: created.length, kind, label },
        fields: ['count', 'kind', 'label'],
      });

      await app.events.publish('access_point.created', {
        restaurantId: auth.restaurantId!,
        accessPointIds: created.map((point) => point.id),
        userId: auth.userId,
      });

      reply.status(201);
      return created.map((point) => ({ ...point, url: accessPointUrl(point.code, app.config) }));
    }),
  );

  app.patch(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_WRITE)],
      schema: {
        tags: ['access-points'],
        summary: 'Renomme ou réaffecte un point d’accès',
        description: 'Le code, lui, reste inchangé : il est déjà imprimé.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateAccessPointSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateAccessPointSchema>;

      const before = await db.accessPoint.findUnique({ where: { id } });
      if (!before) throw notFound('Ce point d’accès');

      const updated = await db.accessPoint.update({
        where: { id },
        data: {
          ...(body.label ? { label: body.label } : {}),
          ...(body.kind ? { kind: body.kind } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'access_point.updated',
        entityType: 'AccessPoint',
        entityId: id,
        before: before as never,
        after: updated as never,
        fields: Object.keys(body),
      });

      return { ...updated, url: accessPointUrl(updated.code, app.config) };
    }),
  );

  app.post(
    '/:id/revoke',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_WRITE)],
      schema: {
        tags: ['access-points'],
        summary: 'Révoque un point d’accès',
        description:
          'Un code révoqué renvoie 404, comme un code inconnu : on ne renseigne pas un curieux ' +
          'sur ce qui a existé. La ligne est conservée pour l’historique.',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const point = await db.accessPoint.findUnique({ where: { id } });
      if (!point) throw notFound('Ce point d’accès');
      if (point.revokedAt) return point;

      const revoked = await db.accessPoint.update({
        where: { id },
        data: { revokedAt: new Date(), isActive: false },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'access_point.revoked',
        entityType: 'AccessPoint',
        entityId: id,
        before: { revokedAt: null, code: point.code },
        after: { revokedAt: revoked.revokedAt, code: point.code },
        fields: ['revokedAt'],
      });

      await app.events.publish('access_point.revoked', {
        restaurantId: auth.restaurantId!,
        accessPointId: id,
        code: point.code,
        userId: auth.userId,
      });

      return revoked;
    }),
  );

  /* ── Aperçu d'un QR, pour le back-office ───────────────────────────────── */
  app.get(
    '/:id/qr.svg',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_READ)],
      schema: {
        tags: ['access-points'],
        summary: 'Aperçu SVG d’un code QR',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, reply, db) => {
      const { id } = request.params as { id: string };
      const restaurantId = requireAuth(request).restaurantId!;

      const point = await db.accessPoint.findUnique({ where: { id } });
      if (!point) throw notFound('Ce point d’accès');

      const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      const svg = await generateQrSvg(
        accessPointUrl(point.code, app.config),
        asTheme(restaurant.theme),
      );

      return reply
        .header('Content-Type', 'image/svg+xml; charset=utf-8')
        .header('Cache-Control', 'private, max-age=3600')
        .send(svg);
    }),
  );

  app.get(
    '/:id/qr.png',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_READ)],
      schema: {
        tags: ['access-points'],
        summary: 'Code QR en PNG haute définition',
        security: [{ bearerAuth: [] }],
        params: idParam,
        querystring: z.object({ size: z.coerce.number().int().min(256).max(2048).default(1024) }),
      },
    },
    scoped(async (request, reply, db) => {
      const { id } = request.params as { id: string };
      const { size } = request.query as { size: number };
      const restaurantId = requireAuth(request).restaurantId!;

      const point = await db.accessPoint.findUnique({ where: { id } });
      if (!point) throw notFound('Ce point d’accès');

      const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      const logo = await loadLogo(restaurant.logoUrl, app.config.STORAGE_PUBLIC_PREFIX);

      const { png } = await generateQrPng(accessPointUrl(point.code, app.config), {
        theme: asTheme(restaurant.theme),
        ...(logo ? { logo } : {}),
        size,
      });

      return reply
        .header('Content-Type', 'image/png')
        .header('Content-Disposition', `inline; filename="qr-${point.code}.png"`)
        .send(png);
    }),
  );

  /* ── Pack d'impression ─────────────────────────────────────────────────── */
  app.get(
    '/pdf',
    {
      onRequest: [app.requires(CAPABILITIES.ACCESS_POINTS_READ)],
      schema: {
        tags: ['access-points'],
        summary: 'Pack d’impression des codes QR (A6 par table, ou planche A4)',
        security: [{ bearerAuth: [] }],
        querystring: accessPointPdfQuerySchema,
      },
    },
    scoped(async (request, reply, db) => {
      const restaurantId = requireAuth(request).restaurantId!;
      const { format, ids } = request.query as { format: 'a6' | 'a4'; ids?: string[] };

      const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      const points = await db.accessPoint.findMany({
        where: { revokedAt: null, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
        orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      });

      if (points.length === 0) {
        throw new AppError(
          'NOT_FOUND',
          'Aucun point d’accès à imprimer. Créez d’abord vos tables.',
        );
      }

      const logo = await loadLogo(restaurant.logoUrl, app.config.STORAGE_PUBLIC_PREFIX);
      const pdf = await buildAccessPointsPdf(
        points.map((point) => ({
          code: point.code,
          label: point.label,
          url: accessPointUrl(point.code, app.config),
        })),
        {
          restaurantName: restaurant.name,
          menuUrl: menuUrlFor(restaurant.slug, app.config),
          theme: asTheme(restaurant.theme),
          ...(logo ? { logo } : {}),
          format,
        },
      );

      const filename = `codes-qr-${restaurant.slug}-${format}.pdf`;
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(Buffer.from(pdf));
    }),
  );
};

/** Charge le logo depuis le stockage pour l'incruster ; son absence n'est pas un problème. */
async function loadLogo(logoUrl: string | null, publicPrefix: string): Promise<Buffer | undefined> {
  if (!logoUrl) return undefined;
  try {
    return await getStorage().get(logoUrl.replace(`${publicPrefix}/`, ''));
  } catch {
    return undefined;
  }
}

export default accessPointRoutes;
