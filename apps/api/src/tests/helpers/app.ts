import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { clearMenuCache } from '../../modules/public/cache.js';
import { setStorage, type StorageAdapter } from '../../services/storage.js';

/**
 * Serveur de test : la vraie application, montée en mémoire.
 *
 * On n'écoute aucun port — `app.inject()` traverse la même pile de hooks, de validations et
 * de gestion d'erreurs qu'une requête réseau. Ce qui passe ici passe en production.
 */

/** Stockage en mémoire : les tests d'images n'écrivent rien sur le disque. */
class MemoryStorage implements StorageAdapter {
  private readonly files = new Map<string, Buffer>();

  async put(key: string, data: Buffer): Promise<void> {
    this.files.set(key, data);
  }
  async get(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) throw new Error(`Introuvable : ${key}`);
    return file;
  }
  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
  async deletePrefix(prefix: string): Promise<void> {
    for (const key of this.files.keys()) if (key.startsWith(prefix)) this.files.delete(key);
  }
  url(key: string): string {
    return `/media/${key}`;
  }
  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }
  get size(): number {
    return this.files.size;
  }
}

export async function createTestApp(
  overrides: Record<string, string> = {},
): Promise<FastifyInstance> {
  setStorage(new MemoryStorage());
  clearMenuCache();

  const config = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    API_PUBLIC_URL: 'http://api.test',
    PUBLIC_MENU_URL: 'http://menu.test',
    ADMIN_URL: 'http://admin.test',
    // Les suites enchaînent les connexions : le limiteur les prendrait pour une attaque.
    RATE_LIMIT_ENABLED: 'false',
    ...overrides,
  });

  const app = await buildApp({ config, logger: false });
  await app.ready();
  return app;
}

/** Ouvre une session et rend le jeton d'accès prêt à l'emploi. */
export async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<{ token: string; cookie: string | undefined }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Connexion refusée pour ${email} : ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ accessToken: string }>();
  const cookies = response.cookies as { name: string; value: string }[];
  const refresh = cookies.find((cookie) => cookie.name === 'evolyx_refresh');

  return {
    token: body.accessToken,
    cookie: refresh ? `evolyx_refresh=${refresh.value}` : undefined,
  };
}

export const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});
