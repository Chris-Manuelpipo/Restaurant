import { z } from 'zod';

/**
 * Configuration validée au démarrage. Une variable manquante ou aberrante arrête le
 * processus tout de suite, avec un message lisible — jamais un `undefined` qui se propage
 * jusqu'à un 500 trois heures plus tard.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire.'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères.'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit faire au moins 32 caractères.'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  PUBLIC_MENU_URL: z.string().url().default('http://localhost:5174'),
  ADMIN_URL: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  /**
   * `path`      — http://menu.local/r/mon-resto  (développement, une seule origine)
   * `subdomain` — http://mon-resto.evolyx.cm     (production)
   */
  MENU_URL_MODE: z.enum(['path', 'subdomain']).default('path'),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  STORAGE_PUBLIC_PREFIX: z.string().default('/media'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): Env {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}\n\nVoir .env.example.`);
  }
  return parsed.data;
}

export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Réinitialise le cache — utilisé par les tests qui manipulent l'environnement. */
export function resetEnvCache(): void {
  cached = undefined;
}

/**
 * URL publique du menu d'un restaurant. Un seul endroit décide de la forme des liens :
 * les QR imprimés, les redirections `/public/q/:code` et le back-office en dépendent.
 */
export function menuUrlFor(slug: string, config: Env = env()): string {
  if (config.MENU_URL_MODE === 'subdomain') {
    const base = new URL(config.PUBLIC_MENU_URL);
    return `${base.protocol}//${slug}.${base.host}`;
  }
  return `${config.PUBLIC_MENU_URL.replace(/\/$/, '')}/r/${slug}`;
}

/** URL courte encodée dans le QR code. Elle survit à tout changement de nom ou de domaine. */
export function accessPointUrl(code: string, config: Env = env()): string {
  return `${config.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/public/q/${code}`;
}
