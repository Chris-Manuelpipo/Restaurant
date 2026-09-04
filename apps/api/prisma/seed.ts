import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import {
  DEFAULT_MODULES,
  type DisplayFontKey,
  type ItemStatus,
} from '@evolyx/shared';
import { asSystem, disconnectDb } from '../src/db/index.js';
import { hashPassword } from '../src/services/password.js';
import { generateAccessCode } from '../src/domain/access-code.js';
import { generatePlaceholder } from '../src/services/images.js';
import { getStorage } from '../src/services/storage.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv();

/**
 * Deux restaurants de démonstration, tirés des maquettes.
 *
 * Ils servent trois usages à la fois : environnement de démonstration, fixtures pour les
 * tests d'intégration, et jeu d'essai pour les mesures de performance. D'où leur réalisme —
 * les prix, les horaires et les traductions manquantes de Casa Lina sont volontaires.
 */

const PASSWORD = process.env.SEED_PASSWORD ?? 'MotDePasseDemo2026';

type Seed = {
  slug: string;
  name: string;
  tagline: string;
  theme: { primary: string; background: string; fontDisplay: DisplayFontKey; cornerRadius: number };
  address: string;
  phone: string;
  whatsapp: string;
  locales: string[];
  hours: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
  logoLetter: string;
  categories: SeedCategory[];
  accessPoints: { kind: 'TABLE' | 'COUNTER' | 'WINDOW' | 'POSTER'; label: string; quantity: number }[];
  rules?: SeedRule[];
};

type SeedCategory = {
  name: Record<string, string>;
  icon?: string;
  items: SeedItem[];
};

type SeedItem = {
  name: Record<string, string>;
  description?: Record<string, string>;
  price?: number;
  variants?: { name: Record<string, string>; price: number }[];
  supplements?: { name: Record<string, string>; price: number }[];
  status?: ItemStatus;
  prepMinutes?: number;
  allergens?: string[];
  badge?: Record<string, string>;
  isPerPerson?: boolean;
  photo?: [string, string];
};

type SeedRule = {
  kind: 'VISIBILITY' | 'PROMO';
  categoryName: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  label?: Record<string, string>;
  discountPercent?: number;
};

/* ═══════════════════════════════════════════════════════════════════════════
   1 — Le Braisé du Carrefour · Douala · charte sombre, français seulement
   ═══════════════════════════════════════════════════════════════════════════ */

const braise: Seed = {
  slug: 'le-braise-du-carrefour',
  name: 'Le Braisé du Carrefour',
  tagline: 'Grillades au feu de bois, tous les soirs à Bonamoussadi.',
  theme: { primary: '#FF6A2C', background: '#17130F', fontDisplay: 'fraunces', cornerRadius: 16 },
  address: 'Carrefour Bonamoussadi, face à la pharmacie — Douala',
  phone: '+237 6 99 12 34 56',
  whatsapp: '+237 6 99 12 34 56',
  locales: ['fr'],
  logoLetter: 'B',
  hours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isOpen: true,
    openTime: '11:00',
    closeTime: '23:00',
  })),
  accessPoints: [
    { kind: 'TABLE', label: 'Table', quantity: 20 },
    { kind: 'COUNTER', label: 'Comptoir', quantity: 1 },
    { kind: 'WINDOW', label: 'Vitrine', quantity: 1 },
  ],
  categories: [
    {
      name: { fr: 'Grillades' },
      icon: '🔥',
      items: [
        {
          name: { fr: 'Poulet braisé entier' },
          description: {
            fr: 'Mariné 12 h au gingembre et à l’ail, braisé lentement au charbon. Servi avec bâton de manioc.',
          },
          price: 4500,
          prepMinutes: 25,
          badge: { fr: 'Le plus commandé' },
          allergens: ['arachide'],
          photo: ['#8A2F0E', '#FF6A2C'],
        },
        {
          name: { fr: 'Demi-poulet braisé' },
          description: { fr: 'La même recette, pour une personne.' },
          price: 2500,
          prepMinutes: 20,
        },
        {
          name: { fr: 'Poulet DG' },
          description: {
            fr: 'Poulet sauté, plantains mûrs, légumes croquants. La recette du dimanche.',
          },
          price: 6000,
          prepMinutes: 30,
          status: 'SOLD_OUT',
          photo: ['#7A3410', '#E0A14A'],
        },
        {
          name: { fr: 'Brochettes de bœuf' },
          description: { fr: 'Trois brochettes, oignons grillés, sauce piquante à part.' },
          price: 1000,
          prepMinutes: 12,
        },
        {
          name: { fr: 'Côtelettes de porc' },
          description: { fr: 'Marinade maison, cuisson au feu de bois.' },
          price: 3500,
          prepMinutes: 22,
        },
      ],
    },
    {
      name: { fr: 'Poissons' },
      icon: '🐟',
      items: [
        {
          name: { fr: 'Maquereau braisé' },
          description: {
            fr: 'Entier, farci aux herbes fraîches et braisé au feu de bois. Servi avec miondo.',
          },
          variants: [
            { name: { fr: 'Petit' }, price: 2500 },
            { name: { fr: 'Moyen' }, price: 3500 },
            { name: { fr: 'Grand' }, price: 4500 },
          ],
          supplements: [
            { name: { fr: 'Miondo (2 bâtons)' }, price: 500 },
            { name: { fr: 'Plantains braisés' }, price: 1000 },
          ],
          prepMinutes: 20,
          allergens: ['poisson', 'arachide'],
          photo: ['#0F3D4A', '#3E8FA6'],
        },
        {
          name: { fr: 'Bar entier grillé' },
          description: { fr: 'Arrivage du matin, pêché à Youpwé.' },
          price: 7000,
          prepMinutes: 25,
          allergens: ['poisson'],
        },
        {
          name: { fr: 'Crevettes sautées' },
          description: { fr: 'Ail, persil, citron vert. Portion généreuse.' },
          price: 5500,
          prepMinutes: 15,
          allergens: ['crustaces'],
        },
        {
          name: { fr: 'Poisson braisé du jour' },
          description: { fr: 'Selon l’arrivage — demandez à votre serveur.' },
          price: 3000,
          prepMinutes: 20,
          allergens: ['poisson'],
        },
      ],
    },
    {
      name: { fr: 'Accompagnements' },
      icon: '🍠',
      items: [
        { name: { fr: 'Bâton de manioc' }, price: 300 },
        { name: { fr: 'Plantains braisés' }, price: 1000 },
        { name: { fr: 'Frites de patate douce' }, price: 1500 },
      ],
    },
    {
      name: { fr: 'Boissons' },
      icon: '🥤',
      items: [
        { name: { fr: 'Jus de gingembre' }, description: { fr: 'Pressé le matin, servi très frais.' }, price: 1000 },
        { name: { fr: 'Bissap' }, price: 1000 },
      ],
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   2 — Casa Lina · charte claire, français et anglais, règles horaires

   Certaines traductions anglaises manquent **volontairement** : c'est ce qui
   éprouve le repli champ par champ de resolveI18n().
   ═══════════════════════════════════════════════════════════════════════════ */

const casa: Seed = {
  slug: 'casa-lina',
  name: 'Casa Lina',
  tagline: 'Pizzas au feu de bois, brunch le dimanche.',
  theme: { primary: '#1F3FBF', background: '#F3F5FA', fontDisplay: 'bricolage', cornerRadius: 12 },
  address: 'Rue Njo-Njo, Bonapriso — Douala',
  phone: '+237 6 77 45 89 01',
  whatsapp: '+237 6 77 45 89 01',
  locales: ['fr', 'en'],
  logoLetter: 'C',
  hours: [
    { dayOfWeek: 0, isOpen: true, openTime: '10:00', closeTime: '22:00' },
    { dayOfWeek: 1, isOpen: true, openTime: '11:30', closeTime: '23:00' },
    { dayOfWeek: 2, isOpen: true, openTime: '11:30', closeTime: '23:00' },
    { dayOfWeek: 3, isOpen: true, openTime: '11:30', closeTime: '23:00' },
    { dayOfWeek: 4, isOpen: true, openTime: '11:30', closeTime: '23:00' },
    { dayOfWeek: 5, isOpen: true, openTime: '11:30', closeTime: '00:30' },
    { dayOfWeek: 6, isOpen: true, openTime: '11:30', closeTime: '00:30' },
  ],
  accessPoints: [{ kind: 'TABLE', label: 'Table', quantity: 25 }],
  rules: [
    {
      kind: 'VISIBILITY',
      categoryName: 'Brunch',
      daysOfWeek: [0],
      startTime: '10:00',
      endTime: '14:00',
    },
    {
      kind: 'PROMO',
      categoryName: 'Cocktails',
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      startTime: '17:00',
      endTime: '19:00',
      label: { fr: 'Happy hour −30 % sur les cocktails', en: 'Happy hour −30% on cocktails' },
      discountPercent: 30,
    },
  ],
  categories: [
    {
      name: { fr: 'Pizzas', en: 'Pizzas' },
      icon: '🍕',
      items: [
        {
          name: { fr: 'Margherita', en: 'Margherita' },
          description: {
            fr: 'Tomate San Marzano, mozzarella fior di latte, basilic frais.',
            en: 'San Marzano tomato, fior di latte mozzarella, fresh basil.',
          },
          variants: [
            { name: { fr: 'Petite — 26 cm', en: 'Small — 26 cm' }, price: 4000 },
            { name: { fr: 'Grande — 33 cm', en: 'Large — 33 cm' }, price: 6000 },
          ],
          supplements: [
            { name: { fr: 'Mozzarella supplémentaire', en: 'Extra mozzarella' }, price: 1000 },
            { name: { fr: 'Basilic frais', en: 'Fresh basil' }, price: 300 },
            { name: { fr: 'Huile pimentée', en: 'Chilli oil' }, price: 200 },
          ],
          prepMinutes: 12,
          allergens: ['gluten', 'lait'],
          photo: ['#1B2F7A', '#5A7FE0'],
        },
        {
          name: { fr: 'Reine', en: 'Queen' },
          // Description volontairement non traduite : le repli doit rendre le français.
          description: { fr: 'Jambon, champignons de Paris, olives noires, mozzarella.' },
          variants: [
            { name: { fr: 'Petite — 26 cm', en: 'Small — 26 cm' }, price: 5000 },
            { name: { fr: 'Grande — 33 cm', en: 'Large — 33 cm' }, price: 7500 },
          ],
          supplements: [{ name: { fr: 'Œuf' }, price: 500 }],
          prepMinutes: 13,
          allergens: ['gluten', 'lait'],
        },
        {
          name: { fr: 'Quatre fromages', en: 'Four cheese' },
          description: { fr: 'Mozzarella, gorgonzola, chèvre, parmesan.' },
          variants: [
            { name: { fr: 'Petite — 26 cm', en: 'Small — 26 cm' }, price: 5500 },
            { name: { fr: 'Grande — 33 cm', en: 'Large — 33 cm' }, price: 8000 },
          ],
          prepMinutes: 13,
          allergens: ['gluten', 'lait'],
        },
        {
          // Nom traduit, badge non traduit : le repli opère champ par champ.
          name: { fr: 'Poulet DG pizza', en: 'DG chicken pizza' },
          description: { fr: 'Notre clin d’œil local : poulet, plantain, poivrons.' },
          variants: [
            { name: { fr: 'Petite — 26 cm' }, price: 6000 },
            { name: { fr: 'Grande — 33 cm' }, price: 8500 },
          ],
          badge: { fr: 'Spécialité de la maison' },
          prepMinutes: 15,
          allergens: ['gluten', 'lait'],
        },
      ],
    },
    {
      name: { fr: 'Entrées', en: 'Starters' },
      icon: '🥗',
      items: [
        {
          name: { fr: 'Bruschetta', en: 'Bruschetta' },
          description: { fr: 'Pain grillé, tomates fraîches, ail, basilic.' },
          price: 2500,
          allergens: ['gluten'],
        },
        {
          name: { fr: 'Burrata', en: 'Burrata' },
          description: {
            fr: 'Burrata crémeuse, tomates cerises, huile d’olive.',
            en: 'Creamy burrata, cherry tomatoes, olive oil.',
          },
          price: 5500,
          allergens: ['lait'],
        },
      ],
    },
    {
      name: { fr: 'Pâtes', en: 'Pasta' },
      icon: '🍝',
      items: [
        {
          name: { fr: 'Spaghetti bolognaise', en: 'Spaghetti bolognese' },
          description: { fr: 'Sauce mijotée trois heures.' },
          price: 5000,
          allergens: ['gluten'],
          prepMinutes: 15,
        },
        {
          name: { fr: 'Penne arrabbiata', en: 'Penne arrabbiata' },
          price: 4500,
          allergens: ['gluten', 'piment'],
        },
      ],
    },
    {
      name: { fr: 'Brunch', en: 'Brunch' },
      icon: '🥞',
      items: [
        {
          name: { fr: 'Formule brunch', en: 'Brunch set' },
          description: {
            fr: 'Œufs, viennoiseries, jus pressé, café ou thé. Servi le dimanche de 10 h à 14 h.',
            en: 'Eggs, pastries, fresh juice, coffee or tea. Sundays, 10 am to 2 pm.',
          },
          price: 9000,
          isPerPerson: true,
          allergens: ['gluten', 'oeuf', 'lait'],
          photo: ['#26408F', '#93A9E8'],
        },
        {
          name: { fr: 'Œufs bénédicte', en: 'Eggs benedict' },
          price: 5500,
          allergens: ['oeuf', 'gluten', 'lait'],
        },
      ],
    },
    {
      name: { fr: 'Cocktails', en: 'Cocktails' },
      icon: '🍸',
      items: [
        {
          name: { fr: 'Mojito', en: 'Mojito' },
          description: { fr: 'Rhum blanc, menthe fraîche, citron vert.' },
          price: 4000,
        },
        { name: { fr: 'Piña colada', en: 'Piña colada' }, price: 4500 },
        { name: { fr: 'Cocktail sans alcool', en: 'Mocktail' }, price: 3000 },
      ],
    },
    {
      name: { fr: 'Desserts', en: 'Desserts' },
      icon: '🍰',
      items: [
        {
          name: { fr: 'Tiramisu', en: 'Tiramisu' },
          description: { fr: 'Recette classique, mascarpone et café.' },
          price: 3000,
          allergens: ['lait', 'oeuf', 'gluten'],
        },
        { name: { fr: 'Panna cotta', en: 'Panna cotta' }, price: 2500, allergens: ['lait'] },
      ],
    },
    {
      name: { fr: 'Boissons chaudes', en: 'Hot drinks' },
      icon: '☕',
      items: [
        { name: { fr: 'Espresso', en: 'Espresso' }, price: 1000 },
        { name: { fr: 'Cappuccino', en: 'Cappuccino' }, price: 1500, allergens: ['lait'] },
      ],
    },
    {
      name: { fr: 'Boissons fraîches', en: 'Cold drinks' },
      icon: '🧃',
      items: [
        { name: { fr: 'Limonade maison', en: 'Homemade lemonade' }, price: 1500 },
        { name: { fr: 'Eau minérale 1 L', en: 'Still water 1 L' }, price: 800 },
      ],
    },
    {
      name: { fr: 'Vins', en: 'Wines' },
      icon: '🍷',
      items: [
        {
          name: { fr: 'Verre de rouge', en: 'Glass of red' },
          price: 3000,
          allergens: ['sulfites'],
        },
      ],
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  console.log('▸ Nettoyage de la base…');
  await asSystem((db) =>
    db.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditLog", "RefreshToken", "Invitation",
        "MenuItemImage", "MenuItemVariant", "MenuItemSupplement",
        "MenuItem", "Category", "AvailabilityRule", "AccessPoint",
        "OpeningHours", "User", "Restaurant"
      RESTART IDENTITY CASCADE;
    `),
  );

  const passwordHash = await hashPassword(PASSWORD);

  await asSystem((db) =>
    db.user.create({
      data: {
        email: 'platform@evolyx.cm',
        passwordHash,
        fullName: 'Administration Evolyx',
        role: 'PLATFORM_ADMIN',
        restaurantId: null,
      },
    }),
  );
  console.log('  · compte plateforme : platform@evolyx.cm');

  for (const seed of [braise, casa]) {
    await seedRestaurant(seed, passwordHash);
  }

  console.log('\n✓ Base peuplée.');
  console.log(`  Mot de passe de tous les comptes : ${PASSWORD}`);
  console.log('  · platform@evolyx.cm            (PLATFORM_ADMIN)');
  console.log('  · admin@lebraise.cm             (ADMIN — Le Braisé du Carrefour)');
  console.log('  · gerant@lebraise.cm            (MANAGER)');
  console.log('  · admin@casalina.cm             (ADMIN — Casa Lina)');
  console.log('  · gerant@casalina.cm            (MANAGER)');
}

async function seedRestaurant(seed: Seed, passwordHash: string): Promise<void> {
  console.log(`\n▸ ${seed.name}`);

  const restaurant = await asSystem((db) =>
    db.restaurant.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        tagline: seed.tagline,
        status: 'ACTIVE',
        theme: seed.theme,
        timezone: 'Africa/Douala',
        currency: 'XAF',
        defaultLocale: 'fr',
        enabledLocales: seed.locales,
        address: seed.address,
        phone: seed.phone,
        whatsapp: seed.whatsapp,
        socials: { instagram: `https://instagram.com/${seed.slug}` },
        enabledModules: [...DEFAULT_MODULES],
        onboardingStep: 5,
        onboardingCompletedAt: new Date(),
        openingHours: { create: seed.hours },
      },
    }),
  );

  // Logo et couverture : des dégradés générés, aucune photo tierce.
  const storage = getStorage();
  const logo = await generatePlaceholder(seed.theme.primary, seed.theme.background, 512, 512);
  const cover = await generatePlaceholder(seed.theme.background, seed.theme.primary, 1280, 640);
  const logoKey = `restaurants/${restaurant.id}/logo-seed.webp`;
  const coverKey = `restaurants/${restaurant.id}/cover-seed.webp`;
  await storage.put(logoKey, logo, 'image/webp');
  await storage.put(coverKey, cover, 'image/webp');

  await asSystem((db) =>
    db.restaurant.update({
      where: { id: restaurant.id },
      data: { logoUrl: storage.url(logoKey), coverUrl: storage.url(coverKey) },
    }),
  );

  const shortSlug = seed.slug === 'le-braise-du-carrefour' ? 'lebraise' : 'casalina';
  await asSystem(async (db) => {
    await db.user.create({
      data: {
        email: `admin@${shortSlug}.cm`,
        passwordHash,
        fullName: `Administrateur ${seed.name}`,
        role: 'ADMIN',
        restaurantId: restaurant.id,
      },
    });
    await db.user.create({
      data: {
        email: `gerant@${shortSlug}.cm`,
        passwordHash,
        fullName: `Gérant ${seed.name}`,
        role: 'MANAGER',
        restaurantId: restaurant.id,
      },
    });
  });

  const categoryIds = new Map<string, string>();
  let itemCount = 0;

  for (const [position, category] of seed.categories.entries()) {
    const created = await asSystem((db) =>
      db.category.create({
        data: {
          restaurantId: restaurant.id,
          name: category.name,
          icon: category.icon ?? null,
          position,
          isVisible: true,
        },
      }),
    );
    categoryIds.set(category.name.fr!, created.id);

    for (const [itemPosition, item] of category.items.entries()) {
      const menuItem = await asSystem((db) =>
        db.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: created.id,
            name: item.name,
            description: item.description ?? undefined,
            basePrice: item.variants ? null : (item.price ?? 0),
            prepMinutes: item.prepMinutes ?? null,
            allergens: item.allergens ?? [],
            isPerPerson: item.isPerPerson ?? false,
            badge: item.badge ?? undefined,
            status: item.status ?? 'AVAILABLE',
            position: itemPosition,
            variants: item.variants
              ? {
                  create: item.variants.map((variant, index) => ({
                    name: variant.name,
                    price: variant.price,
                    position: index,
                  })),
                }
              : undefined,
            supplements: item.supplements
              ? {
                  create: item.supplements.map((supplement, index) => ({
                    name: supplement.name,
                    price: supplement.price,
                    position: index,
                  })),
                }
              : undefined,
          },
        }),
      );
      itemCount += 1;

      if (item.photo) {
        const [from, to] = item.photo;
        const key = (variant: string): string =>
          `restaurants/${restaurant.id}/menu-items/${menuItem.id}/seed-${variant}.webp`;

        for (const [variant, width, height] of [
          ['thumb', 160, 160],
          ['medium', 480, 360],
          ['large', 960, 720],
        ] as const) {
          await storage.put(key(variant), await generatePlaceholder(from, to, width, height), 'image/webp');
        }

        await asSystem((db) =>
          db.menuItem.update({
            where: { id: menuItem.id },
            data: {
              images: {
                create: {
                  storageKey: key('large'),
                  position: 0,
                  variants: {
                    thumb: storage.url(key('thumb')),
                    medium: storage.url(key('medium')),
                    large: storage.url(key('large')),
                    fallback: storage.url(key('medium')),
                    width: 960,
                    height: 720,
                  },
                },
              },
            },
          }),
        );
      }
    }
  }
  console.log(`  · ${seed.categories.length} catégories, ${itemCount} plats`);

  for (const rule of seed.rules ?? []) {
    const targetId = categoryIds.get(rule.categoryName);
    if (!targetId) continue;
    await asSystem((db) =>
      db.availabilityRule.create({
        data: {
          restaurantId: restaurant.id,
          targetType: 'CATEGORY',
          targetId,
          kind: rule.kind,
          daysOfWeek: rule.daysOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
          label: rule.label ?? undefined,
          discountPercent: rule.discountPercent ?? null,
        },
      }),
    );
    console.log(`  · règle ${rule.kind} sur « ${rule.categoryName} »`);
  }

  let created = 0;
  for (const group of seed.accessPoints) {
    for (let index = 0; index < group.quantity; index += 1) {
      const label = group.quantity === 1 ? group.label : `${group.label} ${index + 1}`;
      await asSystem((db) =>
        db.accessPoint.create({
          data: {
            restaurantId: restaurant.id,
            code: generateAccessCode(),
            kind: group.kind,
            label,
            isActive: true,
          },
        }),
      );
      created += 1;
    }
  }
  console.log(`  · ${created} points d’accès`);
}

main()
  .catch((error) => {
    console.error('Seed en échec :', error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
