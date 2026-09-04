import { z } from 'zod';
import { hexColorSchema, hhmmSchema, localeSchema, phoneSchema, slugSchema } from './common.js';
import {
  DISPLAY_FONT_KEYS,
  MODULES,
  RESTAURANT_STATUSES,
  type DisplayFontKey,
} from '../constants.js';

export const themeSchema = z.object({
  primary: hexColorSchema,
  background: hexColorSchema,
  fontDisplay: z.enum(DISPLAY_FONT_KEYS as [DisplayFontKey, ...DisplayFontKey[]]),
  cornerRadius: z.number().int().min(0).max(28),
});

export const socialsSchema = z
  .object({
    facebook: z.string().url().max(200).optional().or(z.literal('')),
    instagram: z.string().url().max(200).optional().or(z.literal('')),
    tiktok: z.string().url().max(200).optional().or(z.literal('')),
    website: z.string().url().max(200).optional().or(z.literal('')),
  })
  .partial();

/**
 * Un créneau d'ouverture. `closeTime` peut précéder `openTime` : le service passe alors
 * minuit (11:00 → 00:30). C'est le cas courant des grillades du vendredi soir, pas une erreur.
 */
export const openingHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    openTime: hhmmSchema,
    closeTime: hhmmSchema,
  })
  .refine((v) => !v.isOpen || v.openTime !== v.closeTime, {
    message: "L'ouverture et la fermeture ne peuvent pas être à la même heure.",
    path: ['closeTime'],
  });

export const openingHoursSchema = z
  .array(openingHourSchema)
  .max(7)
  .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === days.length, {
    message: 'Un seul créneau par jour de la semaine.',
  });

export const updateRestaurantSchema = z
  .object({
    name: z.string().trim().min(2, 'Le nom du restaurant est trop court.').max(80),
    tagline: z.string().trim().max(140).nullable(),
    slug: slugSchema,
    theme: themeSchema,
    timezone: z.string().trim().min(3).max(64),
    currency: z.string().trim().length(3),
    defaultLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    address: z.string().trim().max(240).nullable(),
    phone: phoneSchema.nullable(),
    whatsapp: phoneSchema.nullable(),
    socials: socialsSchema,
    coverPreset: z.string().trim().max(40).nullable(),
    openingHours: openingHoursSchema,
  })
  .partial()
  .refine(
    (v) => !v.enabledLocales || !v.defaultLocale || v.enabledLocales.includes(v.defaultLocale),
    {
      message: 'La langue par défaut doit faire partie des langues activées.',
      path: ['defaultLocale'],
    },
  );

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  tagline: z.string().trim().max(140).optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  status: z.enum(RESTAURANT_STATUSES).optional(),
  enabledModules: z.array(z.string().max(40)).optional(),
  theme: themeSchema.partial().optional(),
  adminEmail: z.string().trim().toLowerCase().email("L'adresse e-mail de l'administrateur est invalide."),
  adminFullName: z.string().trim().min(2).max(80),
});

export const patchPlatformRestaurantSchema = z
  .object({
    status: z.enum(RESTAURANT_STATUSES),
    enabledModules: z.array(z.enum(Object.values(MODULES) as [string, ...string[]])),
  })
  .partial();

export type ThemeSchemaInput = z.infer<typeof themeSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type OpeningHourInput = z.infer<typeof openingHourSchema>;
