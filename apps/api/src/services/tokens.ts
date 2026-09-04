import { createHash, randomBytes } from 'node:crypto';
import { asSystem } from '../db/index.js';
import { env } from '../config/env.js';
import type { Role } from '@evolyx/shared';

/**
 * Jetons d'accès et de rafraîchissement.
 *
 * L'accès (15 min) voyage en `Authorization: Bearer`. Le rafraîchissement (7 j) vit dans un
 * cookie `httpOnly` + `SameSite=Lax` : il n'est jamais lisible par du JavaScript, donc jamais
 * exfiltrable par une injection dans le back-office.
 *
 * Les jetons de rafraîchissement sont stockés **hachés** : une fuite de la base ne donne pas
 * de session. Ils tournent à chaque usage — un jeton présenté deux fois est une anomalie.
 */

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  restaurantId: string | null;
  email: string;
}

export const REFRESH_COOKIE = 'evolyx_refresh';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function refreshExpiry(from = new Date()): Date {
  const days = env().REFRESH_TOKEN_TTL_DAYS;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Émet un jeton de rafraîchissement et l'enregistre haché. Renvoie le jeton en clair. */
export async function issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRefreshToken();
  const expiresAt = refreshExpiry();
  await asSystem((db) =>
    db.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } }),
  );
  return { token, expiresAt };
}

export interface RefreshResult {
  userId: string;
}

/**
 * Consomme un jeton de rafraîchissement : il est révoqué à l'usage, et un nouveau est émis
 * par l'appelant. Un jeton inconnu, expiré ou déjà révoqué ne dit rien de plus que « non ».
 */
export async function consumeRefreshToken(token: string): Promise<RefreshResult | null> {
  const tokenHash = hashToken(token);
  return asSystem(async (db) => {
    const stored = await db.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return null;
    if (stored.revokedAt !== null) {
      // Un jeton rejoué : par prudence, on coupe toute la session de l'utilisateur.
      await db.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    if (stored.expiresAt.getTime() <= Date.now()) return null;

    await db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return { userId: stored.userId };
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await asSystem((db) =>
    db.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await asSystem((db) =>
    db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  );
}

/** Purge les jetons expirés. Appelée au démarrage ; une tâche planifiée s'en chargera plus tard. */
export async function purgeExpiredTokens(): Promise<number> {
  const { count } = await asSystem((db) =>
    db.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  );
  return count;
}

/* ── Jetons d'invitation ───────────────────────────────────────────────────── */

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function inviteExpiry(days = 14, from = new Date()): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
