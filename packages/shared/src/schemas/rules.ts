import { z } from 'zod';
import { hhmmSchema, i18nTextOptionalSchema, idSchema } from './common.js';
import { RULE_KINDS, RULE_TARGETS } from '../constants.js';

/**
 * Règle de disponibilité : rend un plat ou une catégorie visible sur un créneau
 * (`VISIBILITY` — le brunch du dimanche matin) ou signale une promotion (`PROMO` —
 * l'happy hour). Le créneau peut passer minuit, comme les horaires d'ouverture.
 */
export const createRuleSchema = z
  .object({
    targetType: z.enum(RULE_TARGETS),
    targetId: idSchema,
    kind: z.enum(RULE_KINDS),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'Choisissez au moins un jour.')
      .max(7)
      .refine((days) => new Set(days).size === days.length, {
        message: 'Un jour ne peut être choisi deux fois.',
      }),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    label: i18nTextOptionalSchema.nullable().optional(),
    discountPercent: z.number().int().min(1).max(100).nullable().optional(),
  })
  .refine((v) => v.startTime !== v.endTime, {
    message: 'Le début et la fin du créneau ne peuvent pas être identiques.',
    path: ['endTime'],
  })
  .refine((v) => v.kind !== 'PROMO' || (v.label?.fr && v.label.fr.trim() !== ''), {
    message: 'Une promotion doit porter un libellé — il sera affiché aux clients.',
    path: ['label'],
  });

export const updateRuleSchema = z
  .object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    label: i18nTextOptionalSchema.nullable(),
    discountPercent: z.number().int().min(1).max(100).nullable(),
  })
  .partial();

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
