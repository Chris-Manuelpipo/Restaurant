import { z } from 'zod';
import { isValidHex } from '../color.js';
import { isValidHHMM } from '../time.js';
import { LOCALES } from '../constants.js';

/**
 * Un champ traduisible. Le français est **obligatoire** à l'écriture : c'est la langue de
 * repli de toute la plateforme, un champ sans français n'aurait aucune valeur affichable.
 */
export const i18nTextSchema = z
  .object({
    fr: z.string().trim().min(1, 'Le texte français est obligatoire.').max(500),
    en: z.string().trim().max(500).optional(),
  })
  .strict();

export const i18nTextOptionalSchema = z
  .object({
    fr: z.string().trim().max(500).optional(),
    en: z.string().trim().max(500).optional(),
  })
  .strict();

export const localeSchema = z.enum(LOCALES);

export const hexColorSchema = z
  .string()
  .trim()
  .refine(isValidHex, { message: 'Couleur invalide : attendu un code hexadécimal, par exemple #FF6A2C.' });

export const hhmmSchema = z
  .string()
  .trim()
  .refine(isValidHHMM, { message: 'Heure invalide : attendu le format HH:MM, par exemple 08:30.' });

export const idSchema = z.string().min(8).max(40);

/** Slug d'adresse web : minuscules, chiffres et tirets. Il apparaît dans l'URL du menu. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Trois caractères minimum.')
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Uniquement des lettres, des chiffres et des tirets.');

/** Montant en francs : entier, positif, plafonné pour attraper les fautes de frappe. */
export const priceSchema = z
  .number()
  .int('Le prix doit être un nombre entier de francs.')
  .min(0, 'Le prix ne peut pas être négatif.')
  .max(100_000_000, 'Ce prix paraît anormalement élevé.');

export const positionSchema = z.number().int().min(0).max(10_000);

export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^\+?[0-9 ().-]{6,}$/, 'Numéro de téléphone invalide.');

export const reorderSchema = z.object({
  ids: z.array(idSchema).min(1, 'Aucun élément à réordonner.').max(500),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

/** Forme unique des erreurs de l'API. Le front peut s'y fier sans discriminer par statut. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
