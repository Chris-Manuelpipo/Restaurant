import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Prépare la base de test une seule fois par exécution : migrations appliquées, schéma à jour.
 * On applique les vraies migrations plutôt qu'un `db push` — les triggers de contrainte ne
 * vivent que dans le SQL des migrations, et ce sont eux qu'on veut éprouver.
 */
export default async function globalSetup(): Promise<void> {
  const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/evolyx_restaurant_test?schema=public';

  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: process.env.CI ? 'inherit' : 'ignore',
  });
}
