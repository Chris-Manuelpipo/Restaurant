import type { Prisma } from '@prisma/client';
import { DEFAULT_THEME, type ThemeInput } from '@evolyx/shared';

/**
 * Petits ponts entre le typage de Prisma et nos conventions.
 *
 * Ils existent pour une raison précise : l'isolation multi-tenant est appliquée à
 * l'exécution, par l'extension Prisma, alors que le typage, lui, est statique. Sans ces
 * helpers, chaque création exigerait d'écrire `restaurantId` à la main — exactement ce que
 * l'architecture cherche à éviter.
 */

/**
 * Déclare des données de création comme « estampillées par le contexte d'accès ».
 *
 * Le `restaurantId` n'est **pas** fourni ici : c'est l'extension Prisma qui le pose, depuis
 * le contexte de la requête. Ce helper ne fait que l'annoncer au compilateur.
 */
export function owned<T extends object>(data: T): T & { restaurantId: string } {
  return data as T & { restaurantId: string };
}

/** Valeur destinée à une colonne `Json`. */
export function json<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** Valeur `Json` nullable — `null` doit passer par le marqueur de Prisma. */
export function jsonOrNull<T>(value: T | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? (null as never) : (value as unknown as Prisma.InputJsonValue);
}

/** Relit une charte stockée en Json, en comblant ce qui manque. */
export function asTheme(value: unknown): ThemeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_THEME };
  return { ...DEFAULT_THEME, ...(value as Partial<ThemeInput>) };
}
