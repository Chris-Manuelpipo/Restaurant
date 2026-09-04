import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asPlatform, asSystem, asTenant, disconnectDb, getDb } from '../../db/index.js';
import { TenantContextError, runWithTenantContext } from '../../db/tenant-context.js';
import { resetDatabase, seedTestWorld, type TestWorld } from '../helpers/fixtures.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LE test du lot 1.
 *
 *  Deux restaurants voisins partagent une base. Aucun d'eux ne doit pouvoir
 *  lire, modifier ni supprimer quoi que ce soit chez l'autre — même en
 *  connaissant les identifiants exacts, même en les passant explicitement.
 *
 *  Chaque tentative doit se solder par « introuvable », jamais par une erreur
 *  qui confirmerait l'existence de la donnée.
 * ═══════════════════════════════════════════════════════════════════════════
 */

let world: TestWorld;

beforeAll(async () => {
  await asSystem(async () => resetDatabase());
  world = await seedTestWorld();
});

afterAll(async () => {
  await disconnectDb();
});

describe('lecture croisée', () => {
  it('A ne voit que ses propres catégories', async () => {
    const categories = await asTenant(world.a.id, (db) => db.category.findMany());
    expect(categories).toHaveLength(1);
    expect(categories[0]!.restaurantId).toBe(world.a.id);
  });

  it('A ne trouve pas la catégorie de B, même en donnant son identifiant exact', async () => {
    const found = await asTenant(world.a.id, (db) =>
      db.category.findUnique({ where: { id: world.b.categoryId } }),
    );
    expect(found).toBeNull();
  });

  it('A ne trouve pas le plat de B par findFirst', async () => {
    const found = await asTenant(world.a.id, (db) =>
      db.menuItem.findFirst({ where: { id: world.b.itemId } }),
    );
    expect(found).toBeNull();
  });

  it('findUniqueOrThrow lève « introuvable » plutôt que de rendre la donnée de B', async () => {
    await expect(
      asTenant(world.a.id, (db) => db.menuItem.findUniqueOrThrow({ where: { id: world.b.itemId } })),
    ).rejects.toThrow();
  });

  it('A ne compte que ses plats', async () => {
    const total = await asTenant(world.a.id, (db) => db.menuItem.count());
    expect(total).toBe(1);
  });

  it('A ne voit pas les comptes de B, ni le compte plateforme', async () => {
    const users = await asTenant(world.a.id, (db) => db.user.findMany());
    expect(users.map((u) => u.email).sort()).toEqual(
      [world.a.adminEmail, world.a.managerEmail, world.a.staffEmail].sort(),
    );
  });

  it('A ne voit pas le restaurant B, même en le demandant par son slug', async () => {
    const bySlug = await asTenant(world.a.id, (db) =>
      db.restaurant.findUnique({ where: { slug: world.b.slug } }),
    );
    expect(bySlug).toBeNull();

    const all = await asTenant(world.a.id, (db) => db.restaurant.findMany());
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(world.a.id);
  });

  it('A ne voit pas les points d’accès de B', async () => {
    const points = await asTenant(world.a.id, (db) => db.accessPoint.findMany());
    expect(points).toHaveLength(1);
    expect(points[0]!.code).toBe(world.a.accessPointCode);
  });

  it('un filtre restaurantId falsifié ne contourne rien', async () => {
    // Le handler malveillant tente d'imposer l'identifiant de B dans son propre where.
    const items = await asTenant(world.a.id, (db) =>
      db.menuItem.findMany({ where: { restaurantId: world.b.id } }),
    );
    expect(items).toHaveLength(0);
  });

  it('les entités filles restent derrière leur parent', async () => {
    // Une variante appartient à un plat, qui appartient à un restaurant.
    await asSystem(async (db) => {
      await db.menuItem.update({
        where: { id: world.b.itemId },
        data: { basePrice: null, variants: { create: { name: { fr: 'Grand' }, price: 5000 } } },
      });
    });

    const variantes = await asTenant(world.a.id, (db) => db.menuItemVariant.findMany());
    expect(variantes).toHaveLength(0);

    const chezB = await asTenant(world.b.id, (db) => db.menuItemVariant.findMany());
    expect(chezB).toHaveLength(1);
  });
});

describe('écriture croisée', () => {
  it('A ne peut pas modifier un plat de B', async () => {
    await expect(
      asTenant(world.a.id, (db) =>
        db.menuItem.update({ where: { id: world.b.itemId }, data: { basePrice: 1 } }),
      ),
    ).rejects.toThrow();

    const intact = await asSystem((db) =>
      db.menuItem.findUniqueOrThrow({ where: { id: world.b.itemId } }),
    );
    expect(intact.basePrice).toBeNull(); // la variante posée plus haut, pas 1 franc
  });

  it('un updateMany de A ne touche aucune ligne de B', async () => {
    const result = await asTenant(world.a.id, (db) =>
      db.menuItem.updateMany({ where: { id: world.b.itemId }, data: { status: 'DISABLED' } }),
    );
    expect(result.count).toBe(0);

    const intact = await asSystem((db) =>
      db.menuItem.findUniqueOrThrow({ where: { id: world.b.itemId } }),
    );
    expect(intact.status).toBe('AVAILABLE');
  });

  it('A ne peut pas archiver une catégorie de B', async () => {
    const result = await asTenant(world.a.id, (db) =>
      db.category.updateMany({ where: { id: world.b.categoryId }, data: { archivedAt: new Date() } }),
    );
    expect(result.count).toBe(0);
  });

  it('A ne peut pas supprimer un plat de B', async () => {
    await expect(
      asTenant(world.a.id, (db) => db.menuItem.delete({ where: { id: world.b.itemId } })),
    ).rejects.toThrow();

    const deleteMany = await asTenant(world.a.id, (db) =>
      db.menuItem.deleteMany({ where: { id: world.b.itemId } }),
    );
    expect(deleteMany.count).toBe(0);

    const survivant = await asSystem((db) =>
      db.menuItem.findUnique({ where: { id: world.b.itemId } }),
    );
    expect(survivant).not.toBeNull();
  });

  it('une création chez A est estampillée A, même si le payload prétend le contraire', async () => {
    const created = await asTenant(world.a.id, (db) =>
      db.category.create({
        data: {
          restaurantId: world.b.id,
          name: { fr: 'Catégorie infiltrée' },
        } as never,
      }),
    );
    expect(created.restaurantId).toBe(world.a.id);

    await asSystem((db) => db.category.delete({ where: { id: created.id } }));
  });

  it('une mise à jour ne peut pas déplacer une ligne vers un autre restaurant', async () => {
    await asTenant(world.a.id, (db) =>
      db.category.update({
        where: { id: world.a.categoryId },
        data: { restaurantId: world.b.id, icon: '🔥' } as never,
      }),
    );

    const apres = await asSystem((db) =>
      db.category.findUniqueOrThrow({ where: { id: world.a.categoryId } }),
    );
    expect(apres.restaurantId).toBe(world.a.id);
    expect(apres.icon).toBe('🔥'); // le reste de la mise à jour est bien appliqué
  });

  it('A ne peut pas révoquer un point d’accès de B', async () => {
    const result = await asTenant(world.a.id, (db) =>
      db.accessPoint.updateMany({
        where: { code: world.b.accessPointCode },
        data: { isActive: false, revokedAt: new Date() },
      }),
    );
    expect(result.count).toBe(0);
  });

  it('A ne peut pas désactiver un compte de B', async () => {
    const result = await asTenant(world.a.id, (db) =>
      db.user.updateMany({ where: { id: world.b.adminId }, data: { isActive: false } }),
    );
    expect(result.count).toBe(0);

    const intact = await asSystem((db) => db.user.findUniqueOrThrow({ where: { id: world.b.adminId } }));
    expect(intact.isActive).toBe(true);
  });

  it('A ne peut pas créer un compte rattaché à B', async () => {
    const created = await asTenant(world.a.id, (db) =>
      db.user.create({
        data: {
          email: 'infiltre@test.evolyx.cm',
          passwordHash: 'x',
          fullName: 'Infiltré',
          role: 'STAFF',
          restaurantId: world.b.id,
        } as never,
      }),
    );
    expect(created.restaurantId).toBe(world.a.id);
    await asSystem((db) => db.user.delete({ where: { id: created.id } }));
  });
});

describe('garde-fous du contexte', () => {
  it('une requête hors contexte est refusée, pas exécutée sans filtre', async () => {
    await expect(getDb().menuItem.findMany()).rejects.toBeInstanceOf(TenantContextError);
  });

  it('les modèles hors périmètre exigent le mode système', async () => {
    await expect(
      asTenant(world.a.id, (db) => db.refreshToken.findMany()),
    ).rejects.toBeInstanceOf(TenantContextError);

    await expect(asSystem((db) => db.refreshToken.findMany())).resolves.toEqual([]);
  });

  it('les entités filles refusent les accès par identifiant seul', async () => {
    await expect(
      asTenant(world.b.id, (db) =>
        db.menuItemVariant.update({ where: { id: 'peu-importe' }, data: { price: 1 } }),
      ),
    ).rejects.toBeInstanceOf(TenantContextError);

    await expect(
      asTenant(world.b.id, (db) =>
        db.menuItemVariant.create({ data: { menuItemId: world.b.itemId, name: {}, price: 1 } }),
      ),
    ).rejects.toBeInstanceOf(TenantContextError);
  });

  it('le mode plateforme voit tout, explicitement', async () => {
    const restaurants = await asPlatform((db) => db.restaurant.findMany());
    expect(restaurants).toHaveLength(2);
  });

  it('un restaurant ne peut pas se créer lui-même', async () => {
    await expect(
      asTenant(world.a.id, (db) =>
        db.restaurant.create({ data: { slug: 'pirate', name: 'Pirate', theme: {} } }),
      ),
    ).rejects.toBeInstanceOf(TenantContextError);
  });

  it('le contexte suit les frontières asynchrones', async () => {
    const résultat = await runWithTenantContext({ mode: 'tenant', restaurantId: world.a.id }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return getDb().category.findMany();
    });
    expect(résultat.every((c) => c.restaurantId === world.a.id)).toBe(true);
  });

  it('deux contextes concurrents ne se contaminent pas', async () => {
    const [chezA, chezB] = await Promise.all([
      asTenant(world.a.id, (db) => db.menuItem.findMany()),
      asTenant(world.b.id, (db) => db.menuItem.findMany()),
    ]);
    expect(chezA.every((i) => i.restaurantId === world.a.id)).toBe(true);
    expect(chezB.every((i) => i.restaurantId === world.b.id)).toBe(true);
    expect(chezA[0]!.id).not.toBe(chezB[0]!.id);
  });
});
