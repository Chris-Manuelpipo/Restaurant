import { z } from 'zod';
import {
  hexColorSchema,
  i18nTextOptionalSchema,
  i18nTextSchema,
  idSchema,
  positionSchema,
  priceSchema,
} from './common.js';
import { ITEM_STATUSES } from '../constants.js';

/* ── Catégories ─────────────────────────────────────────────────────────── */

export const createCategorySchema = z.object({
  name: i18nTextSchema,
  icon: z.string().trim().max(8).nullable().optional(),
  color: hexColorSchema.nullable().optional(),
  isVisible: z.boolean().default(true),
  position: positionSchema.optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

/* ── Variantes et suppléments ───────────────────────────────────────────── */

export const variantSchema = z.object({
  id: idSchema.optional(),
  name: i18nTextSchema,
  price: priceSchema,
  position: positionSchema.optional(),
});

export const supplementSchema = variantSchema;

/* ── Plats ──────────────────────────────────────────────────────────────── */

const menuItemBase = z.object({
  categoryId: idSchema,
  name: i18nTextSchema,
  description: i18nTextOptionalSchema.optional(),
  basePrice: priceSchema.nullable().optional(),
  prepMinutes: z.number().int().min(0).max(600).nullable().optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  isPerPerson: z.boolean().default(false),
  badge: i18nTextOptionalSchema.nullable().optional(),
  status: z.enum(ITEM_STATUSES).default('AVAILABLE'),
  position: positionSchema.optional(),
  variants: z.array(variantSchema).max(30).default([]),
  supplements: z.array(supplementSchema).max(30).default([]),
});

/**
 * La règle du prix, tenue en trois endroits : ici, dans une contrainte CHECK en base, et
 * dans les tests. Un plat a **soit** un prix de base, **soit** au moins une variante.
 * Les deux à la fois rendrait l'affichage ambigu ; aucun des deux rendrait le plat incommandable.
 */
function priceRule(value: { basePrice?: number | null; variants?: unknown[] }): boolean {
  const hasBase = value.basePrice != null;
  const hasVariants = Array.isArray(value.variants) && value.variants.length > 0;
  return hasBase !== hasVariants;
}

const PRICE_RULE_MESSAGE =
  'Indiquez un prix unique, ou bien au moins une variante (petit, moyen, grand) — mais pas les deux.';

export const createMenuItemSchema = menuItemBase.refine(priceRule, {
  message: PRICE_RULE_MESSAGE,
  path: ['basePrice'],
});

/**
 * En modification partielle, la règle ne s'applique que si l'un des deux champs est touché :
 * changer un simple libellé ne doit pas exiger de renvoyer toute la grille tarifaire.
 */
export const updateMenuItemSchema = menuItemBase.partial().refine(
  (value) =>
    value.basePrice === undefined && value.variants === undefined ? true : priceRule(value),
  { message: PRICE_RULE_MESSAGE, path: ['basePrice'] },
);

export const updateItemStatusSchema = z.object({
  status: z.enum(ITEM_STATUSES),
});

/* ── Import par collage ─────────────────────────────────────────────────── */

export const menuImportPreviewSchema = z.object({
  text: z.string().min(1, 'Collez votre carte pour lancer la lecture.').max(50_000),
  defaultCategoryId: idSchema.optional(),
});

export const menuImportCommitSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        price: priceSchema,
        categoryName: z.string().trim().min(1).max(80).optional(),
        categoryId: idSchema.optional(),
      }),
    )
    .min(1, 'Aucun plat à créer.')
    .max(500),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type MenuImportCommitInput = z.infer<typeof menuImportCommitSchema>;
