import { buildApp } from './app.js';
import { env } from './config/env.js';
import { disconnectDb } from './db/index.js';
import { purgeExpiredTokens } from './services/tokens.js';

/**
 * Point d'entrée. Deux responsabilités : démarrer, et s'arrêter proprement — un conteneur
 * qu'on redéploie ne doit pas couper une requête en cours ni laisser des connexions ouvertes.
 */
async function main(): Promise<void> {
  const config = env();
  const app = await buildApp({ config });

  const purged = await purgeExpiredTokens().catch(() => 0);
  if (purged > 0) app.log.info({ purged }, 'jetons expirés purgés');

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
  app.log.info(
    `API prête · http://localhost:${config.API_PORT}  ·  documentation sur /docs`,
  );

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'arrêt en cours');
    try {
      await app.close();
      await disconnectDb();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'arrêt anormal');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Démarrage impossible :', error);
  process.exit(1);
});
