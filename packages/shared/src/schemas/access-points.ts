import { z } from 'zod';
import { ACCESS_POINT_KINDS } from '../constants.js';

/**
 * Création en lot : « 20 tables » est le geste normal d'une mise en service. Le libellé est
 * alors numéroté automatiquement (Table 1 … Table 20) à partir de `label` comme préfixe.
 */
export const createAccessPointsSchema = z.object({
  kind: z.enum(ACCESS_POINT_KINDS),
  label: z.string().trim().min(1, 'Donnez un libellé, par exemple « Table ».').max(60),
  quantity: z
    .number()
    .int()
    .min(1, 'Au moins un point d’accès.')
    .max(300, 'Trois cents points d’accès au maximum en une fois.')
    .default(1),
  startAt: z.number().int().min(1).max(9999).default(1),
});

export const updateAccessPointSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    kind: z.enum(ACCESS_POINT_KINDS),
    isActive: z.boolean(),
  })
  .partial();

export const accessPointPdfQuerySchema = z.object({
  format: z.enum(['a6', 'a4']).default('a6'),
  ids: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : undefined)),
});

export type CreateAccessPointsInput = z.infer<typeof createAccessPointsSchema>;
export type UpdateAccessPointInput = z.infer<typeof updateAccessPointSchema>;
