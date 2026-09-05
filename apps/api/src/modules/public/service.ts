import {
  DEFAULT_LOCALE,
  resolveI18n,
  type I18nText,
  type Locale,
  type PublicCategory,
  type PublicImage,
  type PublicMenuItem,
  type PublicMenuResponse,
  type PublicOpening,
  type PublicRestaurant,
} from '@evolyx/shared';
import { asSystem, asTenant } from '../../db/index.js';
import { AppError, notFound } from '../../lib/errors.js';
import { asTheme } from '../../lib/prisma-helpers.js';
import { computeOpening, orderedWeek } from '../../domain/opening.js';
import { composeMomentBanner, promoEndLabel } from '../../domain/moment.js';
import {
  activePromos,
  isItemVisible,
  type CategoryRow,
  type ItemRow,
  type RuleRow,
} from '../../domain/visibility.js';

/**
 * Construction du payload du menu public.
 *
 * Une seule requête doit peindre toute la page : charte, infos, horaires, état d'ouverture,
 * catégories, plats, promotions et bandeau du moment. Aucun appel en cascade côté client —
 * sur une connexion lente, chaque aller-retour supplémentaire coûte une seconde.
 *
 * Les textes partent **déjà résolus** dans la langue demandée : le téléphone ne reçoit pas
 * d'objets de traduction qu'il devrait trier lui-même.
 */

export interface MenuQuery {
  slug: string;
  locale?: string;
  /** Instant de simulation — prévisualisation du gérant et tests. Jamais exposé au client. */
  at?: Date;
}

/** Résout le restaurant par son slug, puis rend la main dans son propre périmètre. */
export async function resolvePublicRestaurant(slug: string) {
  const restaurant = await asSystem((db) =>
    db.restaurant.findUnique({
      where: { slug },
      select: { id: true, status: true },
    }),
  );

  if (!restaurant) throw notFound('Ce restaurant');
  if (restaurant.status === 'SUSPENDED') {
    throw new AppError(
      'RESTAURANT_SUSPENDED',
      "Ce menu n'est plus disponible. Contactez le restaurant.",
    );
  }
  return restaurant;
}

export async function buildPublicMenu(query: MenuQuery): Promise<PublicMenuResponse> {
  const { id: restaurantId } = await resolvePublicRestaurant(query.slug);
  const at = query.at ?? new Date();

  return asTenant(restaurantId, async (db) => {
    const restaurant = await db.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      include: { openingHours: true },
    });

    const locale = pickLocale(query.locale, restaurant.enabledLocales, restaurant.defaultLocale);

    const [categories, items, rules] = await Promise.all([
      db.category.findMany({
        where: { archivedAt: null },
        orderBy: { position: 'asc' },
      }),
      db.menuItem.findMany({
        where: { archivedAt: null, status: { not: 'DISABLED' } },
        orderBy: { position: 'asc' },
        include: {
          variants: { orderBy: { position: 'asc' } },
          supplements: { orderBy: { position: 'asc' } },
          images: { orderBy: { position: 'asc' } },
        },
      }),
      db.availabilityRule.findMany(),
    ]);

    const context = {
      at,
      timezone: restaurant.timezone,
      rules: rules as unknown as RuleRow[],
    };

    const categoryById = new Map<string, CategoryRow>(
      categories.map((c) => [c.id, { id: c.id, isVisible: c.isVisible, archivedAt: c.archivedAt }]),
    );

    const visibleItems = items.filter((item) =>
      isItemVisible(item as unknown as ItemRow, categoryById.get(item.categoryId), context),
    );

    const soldOut: { name: string }[] = [];
    const promosSeen: { rule: RuleRow; endsAt: string | null }[] = [];

    const publicCategories: PublicCategory[] = [];
    for (const category of categories) {
      const own = visibleItems.filter((item) => item.categoryId === category.id);
      if (own.length === 0) continue;

      const mapped: PublicMenuItem[] = own.map((item) => {
        const promos = activePromos(item as unknown as ItemRow, context);
        for (const rule of promos) {
          promosSeen.push({ rule, endsAt: promoEndLabel(rule) });
        }

        const name = resolveI18n(item.name as I18nText, locale);
        if (item.status === 'SOLD_OUT') soldOut.push({ name });

        const variants = item.variants.map((variant) => ({
          id: variant.id,
          name: resolveI18n(variant.name as I18nText, locale),
          price: variant.price,
        }));

        const fromPrice =
          item.basePrice ?? (variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0);

        return {
          id: item.id,
          name,
          description: emptyToNull(resolveI18n(item.description as I18nText, locale)),
          basePrice: item.basePrice,
          fromPrice,
          hasVariants: variants.length > 0,
          variants,
          supplements: item.supplements.map((supplement) => ({
            id: supplement.id,
            name: resolveI18n(supplement.name as I18nText, locale),
            price: supplement.price,
          })),
          prepMinutes: item.prepMinutes,
          allergens: item.allergens,
          isPerPerson: item.isPerPerson,
          badge: emptyToNull(resolveI18n(item.badge as I18nText, locale)),
          status: item.status === 'SOLD_OUT' ? 'SOLD_OUT' : 'AVAILABLE',
          images: item.images.map((image) => image.variants as unknown as PublicImage),
          promos: promos.map((rule) => ({
            label: resolveI18n(rule.label as I18nText, locale),
            discountPercent: rule.discountPercent ?? null,
            endsAt: promoEndLabel(rule),
          })),
        };
      });

      publicCategories.push({
        id: category.id,
        name: resolveI18n(category.name as I18nText, locale),
        icon: category.icon,
        color: category.color,
        items: mapped,
      });
    }

    const opening = computeOpening(restaurant.openingHours, at, restaurant.timezone, locale);

    return {
      restaurant: toPublicRestaurant(restaurant, locale),
      opening: toPublicOpening(opening, restaurant.openingHours),
      moment: composeMomentBanner({ activePromos: promosSeen, soldOut, locale }),
      categories: publicCategories,
      locale: locale as Locale,
      generatedAt: at.toISOString(),
    };
  });
}

/** Fiche d'information seule — utilisée par la page « Nous trouver » et les partages. */
export async function buildPublicInfo(slug: string, requestedLocale?: string) {
  const { id } = await resolvePublicRestaurant(slug);

  return asTenant(id, async (db) => {
    const restaurant = await db.restaurant.findUniqueOrThrow({
      where: { id },
      include: { openingHours: true },
    });
    const locale = pickLocale(requestedLocale, restaurant.enabledLocales, restaurant.defaultLocale);
    const opening = computeOpening(restaurant.openingHours, new Date(), restaurant.timezone, locale);

    return {
      restaurant: toPublicRestaurant(restaurant, locale),
      opening: toPublicOpening(opening, restaurant.openingHours),
      locale,
    };
  });
}

/* ── Conversions ───────────────────────────────────────────────────────────── */

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  coverPreset: string | null;
  theme: unknown;
  currency: string;
  timezone: string;
  defaultLocale: string;
  enabledLocales: string[];
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  socials: unknown;
};

function toPublicRestaurant(restaurant: RestaurantRow, _locale: string): PublicRestaurant {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    tagline: restaurant.tagline,
    logoUrl: restaurant.logoUrl,
    coverUrl: restaurant.coverUrl,
    coverPreset: restaurant.coverPreset,
    theme: asTheme(restaurant.theme),
    currency: restaurant.currency,
    timezone: restaurant.timezone,
    defaultLocale: restaurant.defaultLocale as Locale,
    enabledLocales: restaurant.enabledLocales as Locale[],
    address: restaurant.address,
    phone: restaurant.phone,
    whatsapp: restaurant.whatsapp,
    socials: (restaurant.socials ?? {}) as Record<string, string>,
  };
}

function toPublicOpening(
  state: ReturnType<typeof computeOpening>,
  hours: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[],
): PublicOpening {
  return {
    isOpen: state.isOpen,
    nextChange: state.nextChange?.toISOString() ?? null,
    nextChangeLabel: state.nextChangeLabel,
    hours: orderedWeek(hours).map((row) => ({
      dayOfWeek: row.dayOfWeek,
      isOpen: row.isOpen,
      openTime: row.openTime,
      closeTime: row.closeTime,
    })),
  };
}

/** La langue demandée si le restaurant la propose, sinon la sienne. */
export function pickLocale(
  requested: string | undefined,
  enabled: string[],
  fallback: string,
): string {
  if (requested && enabled.includes(requested)) return requested;
  return enabled.includes(fallback) ? fallback : (enabled[0] ?? DEFAULT_LOCALE);
}

const emptyToNull = (value: string): string | null => (value.trim() === '' ? null : value);
