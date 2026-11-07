import type { AccessPointKind } from '@evolyx/shared';
import type { Db } from '../../db/index.js';
import { generateAccessCode } from '../../domain/access-code.js';
import { AppError } from '../../lib/errors.js';
import { owned } from '../../lib/prisma-helpers.js';

/**
 * Crée un point d'accès avec un code neuf. Partagé par les codes QR et les tables.
 *
 * Cinq tentatives suffisent : l'espace de codes est immense, la contrainte `@unique` fait foi.
 */
export async function createAccessPointWithUniqueCode(
  db: Db,
  data: { kind: AccessPointKind; label: string },
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.accessPoint.create({
        data: owned({ code: generateAccessCode(), kind: data.kind, label: data.label }),
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'P2002') throw error;
    }
  }
  throw new AppError('INTERNAL_ERROR', 'Impossible de générer un code unique. Réessayez.');
}
