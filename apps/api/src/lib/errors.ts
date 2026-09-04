/**
 * Erreurs de l'API.
 *
 * Une seule forme de réponse — `{ error: { code, message, details? } }` — et des messages
 * en français, écrits pour le gérant qui les lira dans son back-office, pas pour la console
 * d'un développeur. Le `code` reste stable et machine-lisible ; c'est lui que le front teste.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'MODULE_DISABLED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RESTAURANT_SUSPENDED'
  | 'ACCESS_POINT_REVOKED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  MODULE_DISABLED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RESTAURANT_SUSPENDED: 410,
  ACCESS_POINT_REVOKED: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS[code];
    this.details = details;
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

/* ── Raccourcis des cas les plus fréquents ─────────────────────────────────── */

export const notFound = (quoi = 'La ressource demandée'): AppError =>
  new AppError('NOT_FOUND', `${quoi} est introuvable.`);

export const forbidden = (message = "Vous n'avez pas les droits nécessaires pour cette action."): AppError =>
  new AppError('FORBIDDEN', message);

export const unauthenticated = (message = 'Vous devez être connecté.'): AppError =>
  new AppError('UNAUTHENTICATED', message);

export const conflict = (message: string, details?: unknown): AppError =>
  new AppError('CONFLICT', message, details);

export const validationError = (message: string, details?: unknown): AppError =>
  new AppError('VALIDATION_ERROR', message, details);

/** Traduit les codes d'erreur Prisma en erreurs métier compréhensibles. */
export function fromPrismaError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code: string }).code;
  const meta = (error as { meta?: { target?: string[]; field_name?: string } }).meta;

  switch (code) {
    case 'P2025':
      return notFound();
    case 'P2002': {
      const champs = meta?.target?.join(', ');
      return conflict(
        champs
          ? `Cette valeur est déjà utilisée (${champs}).`
          : 'Cette valeur est déjà utilisée.',
      );
    }
    case 'P2003':
      return validationError("La référence indiquée n'existe pas.");
    case 'P2014':
      return conflict('Cette suppression casserait une donnée liée.');
    default:
      return null;
  }
}
