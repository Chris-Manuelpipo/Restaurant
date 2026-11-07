import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  createTablesSchema,
  linkTableQrSchema,
  listTablesQuerySchema,
  updateTableSchema,
  updateTableStatusSchema,
  type DiningTableSummary,
} from '@evolyx/shared';
import type { Db } from '../../db/index.js';
import { CAPABILITIES } from '../../domain/permissions.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { accessPointUrl } from '../../config/env.js';
import { conflict, notFound, validationError } from '../../lib/errors.js';
import { owned } from '../../lib/prisma-helpers.js';
import { createAccessPointWithUniqueCode } from '../access-points/create.js';

/**
 * Tables de la salle.
 *
 * Une table est l'objet que manipule le personnel : un nom, des places, une zone, un statut.
 * Le code QR est un carton qu'on pose dessus — on peut le changer de table, le retirer ou
 * en générer un neuf sans toucher à la table, et inversement.
 *
 * On archive, on ne supprime pas : demain, des commandes et des réservations y renverront.
 */

const include = {
  accessPoint: { select: { id: true, code: true, isActive: true, revokedAt: true } },
} as const;

type TableRow = Awaited<ReturnType<typeof findTable>> & object;

function findTable(db: Db, id: string) {
  return db.diningTable.findUnique({ where: { id }, include });
}

const tableRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  const serialise = (table: NonNullable<TableRow>): DiningTableSummary => ({
    id: table.id,
    label: table.label,
    seats: table.seats,
    zone: table.zone,
    status: table.status,
    statusChangedAt: table.statusChangedAt.toISOString(),
    sortOrder: table.sortOrder,
    archivedAt: table.archivedAt?.toISOString() ?? null,
    createdAt: table.createdAt.toISOString(),
    accessPoint: table.accessPoint
      ? {
          id: table.accessPoint.id,
          code: table.accessPoint.code,
          isActive: table.accessPoint.isActive && table.accessPoint.revokedAt === null,
          url: accessPointUrl(table.accessPoint.code, app.config),
        }
      : null,
  });

  /** Refuse un nom déjà porté par une autre table en service — le serveur doit savoir où aller. */
  async function assertLabelsFree(db: Db, labels: string[], exceptId?: string): Promise<void> {
    const taken = await db.diningTable.findMany({
      where: {
        archivedAt: null,
        OR: labels.map((label) => ({ label: { equals: label, mode: 'insensitive' as const } })),
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { label: true },
    });
    if (taken.length > 0) {
      const names = taken.map((table) => `« ${table.label} »`).join(', ');
      throw conflict(
        taken.length === 1
          ? `Une table s’appelle déjà ${names}.`
          : `Ces tables existent déjà : ${names}.`,
      );
    }
  }

  async function loadOrFail(db: Db, id: string) {
    const table = await findTable(db, id);
    if (!table) throw notFound('Cette table');
    return table;
  }

  /* ── Liste ──────────────────────────────────────────────────────────────── */
  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.TABLES_READ)],
      schema: {
        tags: ['tables'],
        summary: 'Tables du restaurant',
        security: [{ bearerAuth: [] }],
        querystring: listTablesQuerySchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const { includeArchived } = request.query as z.infer<typeof listTablesQuerySchema>;
      const tables = await db.diningTable.findMany({
        where: includeArchived ? {} : { archivedAt: null },
        include,
        orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return tables.map(serialise);
    }),
  );

  /* ── Création, en lot ───────────────────────────────────────────────────── */
  app.post(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.TABLES_WRITE)],
      schema: {
        tags: ['tables'],
        summary: 'Crée une ou plusieurs tables',
        description:
          '« 12 tables en terrasse » produit Table 1 … Table 12. Avec `withQrCodes`, chaque ' +
          'table reçoit aussi son code QR, déjà rattaché.',
        security: [{ bearerAuth: [] }],
        body: createTablesSchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const body = request.body as z.infer<typeof createTablesSchema>;

      const labels = Array.from({ length: body.quantity }, (_, index) =>
        body.quantity === 1 ? body.label : `${body.label} ${body.startAt + index}`,
      );
      await assertLabelsFree(db, labels);

      const last = await db.diningTable.aggregate({ _max: { sortOrder: true } });
      let sortOrder = (last._max.sortOrder ?? 0) + 1;

      const created = [];
      for (const label of labels) {
        const accessPoint = body.withQrCodes
          ? await createAccessPointWithUniqueCode(db, { kind: 'TABLE', label })
          : null;
        const table = await db.diningTable.create({
          data: owned({
            label,
            seats: body.seats,
            zone: body.zone,
            sortOrder,
            accessPointId: accessPoint?.id ?? null,
          }),
          include,
        });
        created.push(table);
        sortOrder += 1;
      }

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'table.created',
        entityType: 'DiningTable',
        entityId: created[0]?.id ?? 'batch',
        after: {
          count: created.length,
          label: body.label,
          seats: body.seats,
          zone: body.zone,
          withQrCodes: body.withQrCodes,
        },
        fields: ['count', 'label', 'seats', 'zone', 'withQrCodes'],
      });

      if (body.withQrCodes) {
        await app.events.publish('access_point.created', {
          restaurantId: auth.restaurantId!,
          accessPointIds: created.flatMap((table) => table.accessPointId ?? []),
          userId: auth.userId,
        });
      }

      reply.status(201);
      return created.map(serialise);
    }),
  );

  /* ── Modification ───────────────────────────────────────────────────────── */
  app.patch(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.TABLES_WRITE)],
      schema: {
        tags: ['tables'],
        summary: 'Renomme une table, change ses places ou sa zone',
        description:
          'Le libellé du code QR rattaché suit celui de la table ; le code, lui, ne change pas.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateTableSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateTableSchema>;

      const before = await loadOrFail(db, id);
      if (before.archivedAt) throw conflict('Cette table est archivée. Restaurez-la d’abord.');
      if (body.label !== undefined && body.label.toLowerCase() !== before.label.toLowerCase()) {
        await assertLabelsFree(db, [body.label], id);
      }

      const updated = await db.diningTable.update({
        where: { id },
        data: {
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.seats !== undefined ? { seats: body.seats } : {}),
          ...(body.zone !== undefined ? { zone: body.zone } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        include,
      });

      // Le carton porte le nom de la table : on les garde d'accord.
      if (body.label !== undefined && updated.accessPointId) {
        await db.accessPoint.update({
          where: { id: updated.accessPointId },
          data: { label: body.label },
        });
      }

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'table.updated',
        entityType: 'DiningTable',
        entityId: id,
        before: { label: before.label, seats: before.seats, zone: before.zone, sortOrder: before.sortOrder },
        after: { label: updated.label, seats: updated.seats, zone: updated.zone, sortOrder: updated.sortOrder },
        fields: Object.keys(body),
      });

      return serialise(updated);
    }),
  );

  /* ── Statut : le geste du service ───────────────────────────────────────── */
  app.patch(
    '/:id/status',
    {
      onRequest: [app.requires(CAPABILITIES.TABLES_STATUS)],
      schema: {
        tags: ['tables'],
        summary: 'Libre, occupée, réservée ou hors service',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateTableStatusSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const { status } = request.body as z.infer<typeof updateTableStatusSchema>;

      const before = await loadOrFail(db, id);
      if (before.archivedAt) throw conflict('Cette table est archivée.');
      if (before.status === status) return serialise(before);

      const updated = await db.diningTable.update({
        where: { id },
        data: { status, statusChangedAt: new Date() },
        include,
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'table.status_changed',
        entityType: 'DiningTable',
        entityId: id,
        before: { status: before.status },
        after: { status },
        fields: ['status'],
      });

      await app.events.publish('table.status_changed', {
        restaurantId: auth.restaurantId!,
        tableId: id,
        from: before.status,
        to: status,
        userId: auth.userId,
      });

      return serialise(updated);
    }),
  );

  /* ── Carton QR ──────────────────────────────────────────────────────────── */
  app.put(
    '/:id/qr',
    {
      onRequest: [
        app.requires(CAPABILITIES.TABLES_WRITE),
        app.requires(CAPABILITIES.ACCESS_POINTS_WRITE),
      ],
      schema: {
        tags: ['tables'],
        summary: 'Rattache, remplace ou retire le code QR d’une table',
        description:
          '`{ accessPointId }` rattache un code existant, `{ accessPointId: null }` le retire ' +
          '(le code reste valable), `{ generate: true }` en crée un neuf.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: linkTableQrSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof linkTableQrSchema>;

      const table = await loadOrFail(db, id);
      if (table.archivedAt) throw conflict('Cette table est archivée.');

      let accessPointId: string | null;
      if ('generate' in body) {
        const created = await createAccessPointWithUniqueCode(db, { kind: 'TABLE', label: table.label });
        accessPointId = created.id;
        await app.events.publish('access_point.created', {
          restaurantId: auth.restaurantId!,
          accessPointIds: [created.id],
          userId: auth.userId,
        });
      } else if (body.accessPointId === null) {
        accessPointId = null;
      } else {
        const point = await db.accessPoint.findUnique({
          where: { id: body.accessPointId },
          include: { table: { select: { id: true, label: true } } },
        });
        if (!point) throw notFound('Ce code QR');
        if (point.revokedAt) throw validationError('Ce code QR est révoqué : il ne mène plus nulle part.');
        if (point.table && point.table.id !== id) {
          throw conflict(`Ce code est déjà posé sur « ${point.table.label} ». Retirez-le d’abord.`);
        }
        accessPointId = point.id;
        if (point.label !== table.label || point.kind !== 'TABLE') {
          await db.accessPoint.update({
            where: { id: point.id },
            data: { label: table.label, kind: 'TABLE' },
          });
        }
      }

      const updated = await db.diningTable.update({
        where: { id },
        data: { accessPointId },
        include,
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'table.qr_changed',
        entityType: 'DiningTable',
        entityId: id,
        before: { code: table.accessPoint?.code ?? null },
        after: { code: updated.accessPoint?.code ?? null },
        fields: ['code'],
      });

      return serialise(updated);
    }),
  );

  /* ── Archivage ──────────────────────────────────────────────────────────── */
  app.post(
    '/:id/archive',
    {
      onRequest: [app.requires(CAPABILITIES.TABLES_WRITE)],
      schema: {
        tags: ['tables'],
        summary: 'Archive une table',
        description:
          'La table disparaît du service et libère son nom. Son code QR est détaché mais reste ' +
          'valable : on peut le poser sur une autre table ou le révoquer depuis « Codes QR ».',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const table = await loadOrFail(db, id);
      if (table.archivedAt) return serialise(table);

      const archived = await db.diningTable.update({
        where: { id },
        data: { archivedAt: new Date(), accessPointId: null, status: 'FREE' },
        include,
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'table.archived',
        entityType: 'DiningTable',
        entityId: id,
        before: { archivedAt: null, label: table.label, code: table.accessPoint?.code ?? null },
        after: { archivedAt: archived.archivedAt, label: table.label, code: null },
        fields: ['archivedAt', 'code'],
      });

      return serialise(archived);
    }),
  );

  app.post(
    '/:id/restore',
    {
      onRequest: [app.requires(CAPABILITIES.TABLES_WRITE)],
      schema: {
        tags: ['tables'],
        summary: 'Remet une table archivée en service',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const table = await loadOrFail(db, id);
      if (!table.archivedAt) return serialise(table);
      await assertLabelsFree(db, [table.label], id);

      const restored = await db.diningTable.update({
        where: { id },
        data: { archivedAt: null },
        include,
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'table.restored',
        entityType: 'DiningTable',
        entityId: id,
        before: { archivedAt: table.archivedAt },
        after: { archivedAt: null },
        fields: ['archivedAt'],
      });

      return serialise(restored);
    }),
  );
};

export default tableRoutes;
