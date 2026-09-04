import argon2 from 'argon2';

/**
 * Argon2id, paramètres OWASP 2024 : 19 Mio de mémoire, 2 passes, parallélisme 1.
 * Ce sont les réglages qui tiennent sur un petit VPS tout en restant coûteux à attaquer.
 */
const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

/**
 * Vérifie un mot de passe. Ne laisse jamais remonter d'exception : un hash corrompu en base
 * doit se traduire par « identifiants invalides », pas par une 500 qui révèle l'anomalie.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain, OPTIONS);
  } catch {
    return false;
  }
}
