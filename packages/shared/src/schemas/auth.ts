import { z } from 'zod';
import { ROLES } from '../constants.js';

const emailSchema = z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(160);

/**
 * Mot de passe : longueur d'abord. Douze caractères sans contrainte de composition protègent
 * mieux qu'une majuscule et un chiffre imposés sur huit — et se retiennent sur un clavier
 * de téléphone, ce qui compte quand le gérant se connecte depuis la salle.
 */
const passwordSchema = z
  .string()
  .min(12, 'Douze caractères minimum — une phrase courte fait très bien l’affaire.')
  .max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.').max(200),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(400),
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(80).optional(),
});

export const createUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(2, 'Nom trop court.').max(80),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
  password: passwordSchema.optional(),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
    isActive: z.boolean(),
    password: passwordSchema,
  })
  .partial();

export const roleSchema = z.enum(ROLES);

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
