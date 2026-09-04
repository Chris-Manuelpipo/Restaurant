import { createId } from '@paralleldrive/cuid2';
import { DEFAULT_MODULES, DEFAULT_THEME } from '@evolyx/shared';
import { asSystem, getDb, type Db } from '../../db/index.js';
import { hashPassword } from '../../services/password.js';

/**
 * Jeu de données minimal mais complet pour les tests : deux restaurants voisins, chacun
 * avec ses comptes, sa catégorie et son plat. C'est le décor du test d'isolation — deux
 * restaurants qui n'ont aucune raison de se voir.
 */

export const TEST_PASSWORD = 'MotDePasseDeTest2026';

export interface SeededRestaurant {
  id: string;
  slug: string;
  categoryId: string;
  itemId: string;
  accessPointCode: string;
  adminId: string;
  adminEmail: string;
  managerId: string;
  managerEmail: string;
  staffId: string;
  staffEmail: string;
}

export interface TestWorld {
  a: SeededRestaurant;
  b: SeededRestaurant;
  platformAdminId: string;
  platformAdminEmail: string;
}

/** Vide toutes les tables. Plus rapide et plus sûr qu'un `migrate reset` entre deux suites. */
export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog", "RefreshToken", "Invitation",
      "MenuItemImage", "MenuItemVariant", "MenuItemSupplement",
      "MenuItem", "Category", "AvailabilityRule", "AccessPoint",
      "OpeningHours", "User", "Restaurant"
    RESTART IDENTITY CASCADE;
  `);
}

export async function seedTestWorld(): Promise<TestWorld> {
  return asSystem(async (db) => {
    const a = await seedRestaurant(db, 'braise-test', 'Le Braisé (test)', 'AAAAA1');
    const b = await seedRestaurant(db, 'casa-test', 'Casa Lina (test)', 'BBBBB2');

    const platformAdminEmail = 'platform@test.evolyx.cm';
    const platformAdmin = await db.user.create({
      data: {
        email: platformAdminEmail,
        passwordHash: await hashPassword(TEST_PASSWORD),
        fullName: 'Admin plateforme',
        role: 'PLATFORM_ADMIN',
        restaurantId: null,
      },
    });

    return { a, b, platformAdminId: platformAdmin.id, platformAdminEmail };
  });
}

async function seedRestaurant(
  db: Db,
  slug: string,
  name: string,
  accessPointCode: string,
): Promise<SeededRestaurant> {
  const restaurant = await db.restaurant.create({
    data: {
      id: createId(),
      slug,
      name,
      status: 'ACTIVE',
      theme: { ...DEFAULT_THEME },
      enabledModules: [...DEFAULT_MODULES],
      enabledLocales: ['fr'],
      onboardingStep: 5,
      onboardingCompletedAt: new Date(),
      openingHours: {
        create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          id: createId(),
          dayOfWeek,
          isOpen: true,
          openTime: '11:00',
          closeTime: '23:00',
        })),
      },
    },
  });

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [admin, manager, staff] = await Promise.all([
    db.user.create({
      data: {
        email: `admin@${slug}.test`,
        passwordHash,
        fullName: `Admin ${name}`,
        role: 'ADMIN',
        restaurantId: restaurant.id,
      },
    }),
    db.user.create({
      data: {
        email: `manager@${slug}.test`,
        passwordHash,
        fullName: `Gérant ${name}`,
        role: 'MANAGER',
        restaurantId: restaurant.id,
      },
    }),
    db.user.create({
      data: {
        email: `staff@${slug}.test`,
        passwordHash,
        fullName: `Serveur ${name}`,
        role: 'STAFF',
        restaurantId: restaurant.id,
      },
    }),
  ]);

  const category = await db.category.create({
    data: {
      restaurantId: restaurant.id,
      name: { fr: 'Grillades' },
      position: 0,
      isVisible: true,
    },
  });

  const item = await db.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: { fr: `Plat de ${name}` },
      description: { fr: 'Description de test.' },
      basePrice: 3500,
      status: 'AVAILABLE',
      position: 0,
    },
  });

  await db.accessPoint.create({
    data: {
      restaurantId: restaurant.id,
      code: accessPointCode,
      kind: 'TABLE',
      label: 'Table 1',
      isActive: true,
    },
  });

  return {
    id: restaurant.id,
    slug,
    categoryId: category.id,
    itemId: item.id,
    accessPointCode,
    adminId: admin.id,
    adminEmail: admin.email,
    managerId: manager.id,
    managerEmail: manager.email,
    staffId: staff.id,
    staffEmail: staff.email,
  };
}
