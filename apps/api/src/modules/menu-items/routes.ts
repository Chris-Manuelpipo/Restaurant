import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  PLACEHOLDER_CATEGORY_NAME,
  createMenuItemSchema,
  menuImportCommitSchema,
  menuImportPreviewSchema,
  reorderSchema,
  updateItemStatusSchema,
  updateMenuItemSchema,
} from '@evolyx/shared';
import { CAPABILITIES } from '../../domain/permissions.js';
import { parseMenuText } from '../../domain/menu-import.js';
import { scoped } from '../../lib/scope.js';
import { requireAuth } from '../../plugins/auth.js';
import { recordAudit } from '../../services/audit.js';
import { processMenuItemImage } from '../../services/images.js';
import { getStorage } from '../../services/storage.js';
import { AppError, notFound } from '../../lib/errors.js';
import { json, jsonOrNull, owned } from '../../lib/prisma-helpers.js';

/**
 * Plats.
 *
 * Deux gestes ont un traitement à part :
 *  - **le statut** (`PATCH /:id/status`) est l'action du quotidien : le gérant marque un plat
 *    épuisé en plein service, depuis son téléphone. Route étroite, payload minuscule, aucune
 *    relecture inutile — et un événement qui vide le cache du menu public dans la foulée ;
 *  - **le prix** est audité systématiquement, parce que c'est la donnée qu'on cherche à
 *    reconstituer six mois plus tard quand un client conteste une addition.
 */
const menuItemRoutes: FastifyPluginAsync = async (app) => {
  const idParam = z.object({ id: z.string().min(8).max(40) });

  const include = {
    variants: { orderBy: { position: 'asc' } },
    supplements: { orderBy: { position: 'asc' } },
    images: { orderBy: { position: 'asc' } },
  } as const;

  app.get(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_READ)],
      schema: {
        tags: ['menu'],
        summary: 'Plats du restaurant',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          categoryId: z.string().optional(),
          status: z.enum(['AVAILABLE', 'SOLD_OUT', 'DISABLED']).optional(),
          includeArchived: z.coerce.boolean().default(false),
          search: z.string().max(80).optional(),
        }),
      },
    },
    scoped(async (request, _reply, db) => {
      const query = request.query as {
        categoryId?: string;
        status?: 'AVAILABLE' | 'SOLD_OUT' | 'DISABLED';
        includeArchived: boolean;
        search?: string;
      };

      return db.menuItem.findMany({
        where: {
          ...(query.includeArchived ? {} : { archivedAt: null }),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.search
            ? { name: { path: ['fr'], string_contains: query.search } }
            : {}),
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include,
      });
    }),
  );

  app.get(
    '/:id',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_READ)],
      schema: {
        tags: ['menu'],
        summary: 'Détail d’un plat',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const { id } = request.params as { id: string };
      const item = await db.menuItem.findUnique({ where: { id }, include });
      if (!item) throw notFound('Ce plat');
      return item;
    }),
  );

  app.post(
    '/',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Crée un plat',
        security: [{ bearerAuth: [] }],
        body: createMenuItemSchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const body = request.body as z.infer<typeof createMenuItemSchema>;

      const category = await db.category.findUnique({ where: { id: body.categoryId } });
      if (!category) throw notFound('Cette catégorie');

      const last = await db.menuItem.findFirst({
        where: { categoryId: body.categoryId },
        orderBy: { position: 'desc' },
      });

      const created = await db.menuItem.create({
        data: owned({
          categoryId: body.categoryId,
          name: json(body.name),
          description: jsonOrNull(body.description),
          basePrice: body.basePrice ?? null,
          prepMinutes: body.prepMinutes ?? null,
          allergens: body.allergens,
          isPerPerson: body.isPerPerson,
          badge: jsonOrNull(body.badge),
          status: body.status,
          position: body.position ?? (last ? last.position + 1 : 0),
          variants: {
            create: body.variants.map((variant, index) => ({
              name: json(variant.name),
              price: variant.price,
              position: variant.position ?? index,
            })),
          },
          supplements: {
            create: body.supplements.map((supplement, index) => ({
              name: json(supplement.name),
              price: supplement.price,
              position: supplement.position ?? index,
            })),
          },
        }),
        include,
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'item.created',
        entityType: 'MenuItem',
        entityId: created.id,
        after: created as never,
        fields: ['name', 'basePrice', 'status', 'categoryId'],
      });

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: created.id,
        changedFields: ['created'],
        userId: auth.userId,
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
        summary: 'Modifie un plat',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateMenuItemSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateMenuItemSchema>;

      const before = await db.menuItem.findUnique({ where: { id }, include });
      if (!before) throw notFound('Ce plat');

      if (body.categoryId) {
        const category = await db.category.findUnique({ where: { id: body.categoryId } });
        if (!category) throw notFound('Cette catégorie');
      }

      // Variantes et suppléments sont remplacés en bloc : ils n'ont pas d'identité propre
      // pour l'utilisateur, qui manipule une liste, pas des lignes.
      const updated = await db.menuItem.update({
        where: { id },
        data: {
          ...(body.categoryId ? { categoryId: body.categoryId } : {}),
          ...(body.name ? { name: json(body.name) } : {}),
          ...(body.description !== undefined ? { description: jsonOrNull(body.description) } : {}),
          ...(body.basePrice !== undefined ? { basePrice: body.basePrice } : {}),
          ...(body.prepMinutes !== undefined ? { prepMinutes: body.prepMinutes } : {}),
          ...(body.allergens ? { allergens: body.allergens } : {}),
          ...(body.isPerPerson !== undefined ? { isPerPerson: body.isPerPerson } : {}),
          ...(body.badge !== undefined ? { badge: jsonOrNull(body.badge) } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
          ...(body.variants
            ? {
                variants: {
                  deleteMany: {},
                  create: body.variants.map((variant, index) => ({
                    name: json(variant.name),
                    price: variant.price,
                    position: variant.position ?? index,
                  })),
                },
              }
            : {}),
          ...(body.supplements
            ? {
                supplements: {
                  deleteMany: {},
                  create: body.supplements.map((supplement, index) => ({
                    name: json(supplement.name),
                    price: supplement.price,
                    position: supplement.position ?? index,
                  })),
                },
              }
            : {}),
        },
        include,
      });

      const priceChanged = body.basePrice !== undefined && before.basePrice !== updated.basePrice;
      const variantsChanged =
        body.variants !== undefined &&
        JSON.stringify(before.variants.map((v) => v.price)) !==
          JSON.stringify(updated.variants.map((v) => v.price));

      if (priceChanged || variantsChanged) {
        await recordAudit({
          restaurantId: auth.restaurantId,
          userId: auth.userId,
          action: 'price.changed',
          entityType: 'MenuItem',
          entityId: id,
          before: { basePrice: before.basePrice, variants: before.variants.map((v) => v.price) },
          after: { basePrice: updated.basePrice, variants: updated.variants.map((v) => v.price) },
          fields: ['basePrice', 'variants'],
        });
        await app.events.publish('menu_item.price_changed', {
          restaurantId: auth.restaurantId!,
          itemId: id,
          from: before.basePrice,
          to: updated.basePrice,
          userId: auth.userId,
        });
      }

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'item.updated',
        entityType: 'MenuItem',
        entityId: id,
        before: before as never,
        after: updated as never,
        fields: Object.keys(body).filter((key) => key !== 'variants' && key !== 'supplements'),
      });

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: id,
        changedFields: Object.keys(body),
        userId: auth.userId,
      });

      return updated;
    }),
  );

  /* ── Le geste du quotidien ─────────────────────────────────────────────── */
  app.patch(
    '/:id/status',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_STATUS)],
      schema: {
        tags: ['menu'],
        summary: 'Marque un plat disponible, épuisé ou désactivé',
        description:
          'Ouvert à tous les rôles, y compris STAFF : marquer un plat épuisé doit être ' +
          'instantané, depuis la salle, sans passer par un responsable.',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: updateItemStatusSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const { status } = request.body as z.infer<typeof updateItemStatusSchema>;

      const before = await db.menuItem.findUnique({
        where: { id },
        select: { id: true, status: true, name: true },
      });
      if (!before) throw notFound('Ce plat');
      if (before.status === status) return before;

      const updated = await db.menuItem.update({
        where: { id },
        data: { status },
        select: { id: true, status: true, name: true },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'item.status_changed',
        entityType: 'MenuItem',
        entityId: id,
        before: { status: before.status },
        after: { status: updated.status },
        fields: ['status'],
      });

      await app.events.publish('menu_item.status_changed', {
        restaurantId: auth.restaurantId!,
        itemId: id,
        from: before.status,
        to: updated.status,
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
        summary: 'Archive un plat (aucune suppression réelle)',
        security: [{ bearerAuth: [] }],
        params: idParam,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const item = await db.menuItem.findUnique({ where: { id } });
      if (!item) throw notFound('Ce plat');
      if (item.archivedAt) return item;

      const archived = await db.menuItem.update({
        where: { id },
        data: { archivedAt: new Date(), status: 'DISABLED' },
      });

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'item.archived',
        entityType: 'MenuItem',
        entityId: id,
        before: { archivedAt: null },
        after: { archivedAt: archived.archivedAt },
        fields: ['archivedAt'],
      });

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: id,
        changedFields: ['archivedAt'],
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
        summary: 'Réordonne les plats',
        security: [{ bearerAuth: [] }],
        body: reorderSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { ids } = request.body as z.infer<typeof reorderSchema>;

      await db.$transaction(
        ids.map((id, position) => db.menuItem.updateMany({ where: { id }, data: { position } })),
      );

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: ids[0]!,
        changedFields: ['position'],
        userId: auth.userId,
      });

      return db.menuItem.findMany({ where: { archivedAt: null }, orderBy: { position: 'asc' } });
    }),
  );

  /* ── Photos ────────────────────────────────────────────────────────────── */
  app.post(
    '/:id/images',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Ajoute une photo (multipart) et génère ses dérivés',
        security: [{ bearerAuth: [] }],
        params: idParam,
        consumes: ['multipart/form-data'],
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };

      const item = await db.menuItem.findUnique({ where: { id }, select: { id: true } });
      if (!item) throw notFound('Ce plat');

      const file = await request.file();
      if (!file) throw new AppError('VALIDATION_ERROR', 'Aucun fichier reçu.');

      const buffer = await file.toBuffer();
      const processed = await processMenuItemImage(
        buffer,
        file.mimetype,
        auth.restaurantId!,
        id,
      );

      const last = await db.menuItemImage.findFirst({
        where: { menuItemId: id },
        orderBy: { position: 'desc' },
      });

      // Passage par le plat : l'extension refuse une création directe sur une entité fille.
      const updated = await db.menuItem.update({
        where: { id },
        data: {
          images: {
            create: {
              storageKey: processed.storageKey,
              position: last ? last.position + 1 : 0,
              variants: json(processed.variants),
            },
          },
        },
        include,
      });

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: id,
        changedFields: ['images'],
        userId: auth.userId,
      });

      reply.status(201);
      return updated;
    }),
  );

  app.delete(
    '/:id/images/:imageId',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Retire une photo',
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.string().min(8).max(40),
          imageId: z.string().min(8).max(40),
        }),
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id, imageId } = request.params as { id: string; imageId: string };

      const image = await db.menuItemImage.findFirst({ where: { id: imageId, menuItemId: id } });
      if (!image) throw notFound('Cette photo');

      // deleteMany porte le filtre du parent : c'est la seule voie sûre sur une entité fille.
      await db.menuItemImage.deleteMany({ where: { id: imageId, menuItemId: id } });

      const storage = getStorage();
      const variants = image.variants as Record<string, string>;
      for (const key of ['thumb', 'medium', 'large', 'fallback']) {
        const url = variants[key];
        if (typeof url === 'string') {
          await storage
            .delete(url.replace(`${app.config.STORAGE_PUBLIC_PREFIX}/`, ''))
            .catch(() => undefined);
        }
      }

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: id,
        changedFields: ['images'],
        userId: auth.userId,
      });

      return db.menuItem.findUniqueOrThrow({ where: { id }, include });
    }),
  );

  /**
   * Ordre des photos. La première est celle que le client voit sur la carte ; les suivantes
   * n'apparaissent que dans la fiche du plat. Pouvoir la choisir compte : on photographie
   * rarement le meilleur angle en premier.
   */
  app.post(
    '/:id/images/reorder',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Réordonne les photos d’un plat',
        security: [{ bearerAuth: [] }],
        params: idParam,
        body: reorderSchema,
      },
    },
    scoped(async (request, _reply, db) => {
      const auth = requireAuth(request);
      const { id } = request.params as { id: string };
      const { ids } = request.body as z.infer<typeof reorderSchema>;

      const item = await db.menuItem.findUnique({ where: { id }, select: { id: true } });
      if (!item) throw notFound('Ce plat');

      // `updateMany` porte le filtre du parent : une photo d'un autre plat ne bougera pas.
      await db.$transaction(
        ids.map((imageId, position) =>
          db.menuItemImage.updateMany({ where: { id: imageId, menuItemId: id }, data: { position } }),
        ),
      );

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: id,
        changedFields: ['images'],
        userId: auth.userId,
      });

      return db.menuItem.findUniqueOrThrow({ where: { id }, include });
    }),
  );

  /* ── Import par collage ────────────────────────────────────────────────── */
  app.post(
    '/import',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Analyse une carte collée et renvoie un aperçu (aucune écriture)',
        security: [{ bearerAuth: [] }],
        body: menuImportPreviewSchema,
      },
    },
    scoped(async (request) => {
      const { text } = request.body as z.infer<typeof menuImportPreviewSchema>;
      return parseMenuText(text);
    }),
  );

  app.post(
    '/import/commit',
    {
      onRequest: [app.requires(CAPABILITIES.MENU_WRITE)],
      schema: {
        tags: ['menu'],
        summary: 'Crée les plats confirmés par le gérant',
        security: [{ bearerAuth: [] }],
        body: menuImportCommitSchema,
      },
    },
    scoped(async (request, reply, db) => {
      const auth = requireAuth(request);
      const { items } = request.body as z.infer<typeof menuImportCommitSchema>;

      const existing = await db.category.findMany({ where: { archivedAt: null } });
      const byName = new Map(
        existing.map((category) => [
          normalise((category.name as { fr?: string }).fr ?? ''),
          category,
        ]),
      );
      let nextPosition = existing.length;

      /** Trouve ou crée la catégorie voulue ; à défaut, la corbeille « À classer ». */
      const resolveCategory = async (name?: string): Promise<string> => {
        const wanted = name?.trim() ? name.trim() : PLACEHOLDER_CATEGORY_NAME.fr;
        const key = normalise(wanted);
        const found = byName.get(key);
        if (found) return found.id;

        const created = await db.category.create({
          data: owned({
            name: json(
              wanted === PLACEHOLDER_CATEGORY_NAME.fr ? PLACEHOLDER_CATEGORY_NAME : { fr: wanted },
            ),
            position: nextPosition++,
            isVisible: true,
          }),
        });
        byName.set(key, created);
        return created.id;
      };

      const created: { id: string; name: string; price: number }[] = [];
      for (const [index, row] of items.entries()) {
        const categoryId = row.categoryId ?? (await resolveCategory(row.categoryName));
        const item = await db.menuItem.create({
          data: owned({
            categoryId,
            name: json({ fr: row.name }),
            basePrice: row.price,
            position: index,
            status: 'AVAILABLE' as const,
          }),
        });
        created.push({ id: item.id, name: row.name, price: row.price });
      }

      await recordAudit({
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        action: 'item.created',
        entityType: 'MenuItem',
        entityId: 'import',
        after: { count: created.length },
        fields: ['count'],
      });

      await app.events.publish('menu_item.updated', {
        restaurantId: auth.restaurantId!,
        itemId: created[0]?.id ?? 'import',
        changedFields: ['import'],
        userId: auth.userId,
      });

      reply.status(201);
      return { created: created.length, items: created };
    }),
  );
};

const normalise = (value: string): string =>
  value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export default menuItemRoutes;
