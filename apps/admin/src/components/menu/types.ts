import type { I18nText, ItemStatus } from '@evolyx/shared';

/** Les formes renvoyées par l'API pour l'écran « La carte ». */

export interface CategoryRow {
  id: string;
  name: I18nText;
  icon: string | null;
  imageUrl: string | null;
  color: string | null;
  position: number;
  isVisible: boolean;
  archivedAt: string | null;
  _count?: { menuItems: number };
}

export interface ItemImage {
  id: string;
  variants: { thumb: string; medium: string; large: string; fallback: string };
}

export interface ItemRow {
  id: string;
  categoryId: string;
  name: I18nText;
  description: I18nText | null;
  basePrice: number | null;
  prepMinutes: number | null;
  allergens: string[];
  badge: I18nText | null;
  isPerPerson: boolean;
  status: ItemStatus;
  position: number;
  archivedAt: string | null;
  variants: { id: string; name: I18nText; price: number }[];
  supplements: { id: string; name: I18nText; price: number }[];
  images: ItemImage[];
}

/** Le prix affiché d'un plat : son prix unique, ou le plus bas de ses variantes. */
export function displayPrice(item: ItemRow): { amount: number; from: boolean } {
  if (item.basePrice !== null) return { amount: item.basePrice, from: false };
  if (item.variants.length === 0) return { amount: 0, from: false };
  return { amount: Math.min(...item.variants.map((variant) => variant.price)), from: true };
}
