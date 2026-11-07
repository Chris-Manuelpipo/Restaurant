import { z } from 'zod';
import { TABLE_STATUSES } from '../constants.js';

const label = z.string().trim().min(1, 'Donnez un nom, par exemple « Table 4 ».').max(60);
const seats = z
  .number()
  .int()
  .min(1, 'Au moins une place.')
  .max(100, 'Cent places au maximum.');
/** Une zone vide n'est pas une zone : la chaîne vide redevient `null`. */
const zone = z
  .string()
  .trim()
  .max(40, 'Quarante caractères au plus.')
  .nullish()
  .transform((value) => (value ? value : null));

/**
 * Création en lot, comme pour les codes QR : « 12 tables en terrasse, 4 places ».
 * Au-delà d'une unité, `label` sert de préfixe et les tables sont numérotées.
 */
export const createTablesSchema = z.object({
  label,
  quantity: z
    .number()
    .int()
    .min(1, 'Au moins une table.')
    .max(200, 'Deux cents tables au maximum en une fois.')
    .default(1),
  startAt: z.number().int().min(1).max(9999).default(1),
  seats: seats.default(4),
  zone,
  /** Génère aussi un code QR par table, déjà rattaché. */
  withQrCodes: z.boolean().default(false),
});

export const updateTableSchema = z
  .object({
    label,
    seats,
    zone,
    sortOrder: z.number().int().min(0).max(100_000),
  })
  .partial();

/** Le geste du service : libre, occupée, réservée, hors service. */
export const updateTableStatusSchema = z.object({
  status: z.enum(TABLE_STATUSES),
});

/**
 * Rattacher un carton : un code existant (`accessPointId`), un code neuf (`generate`),
 * ou aucun (`accessPointId: null`, la table perd son carton, le code reste valable).
 */
export const linkTableQrSchema = z.union([
  z.object({ accessPointId: z.string().min(8).max(40).nullable() }),
  z.object({ generate: z.literal(true) }),
]);

export const listTablesQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type CreateTablesInput = z.infer<typeof createTablesSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type LinkTableQrInput = z.infer<typeof linkTableQrSchema>;
