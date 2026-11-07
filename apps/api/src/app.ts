import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env, type Env } from './config/env.js';
import { AppError, fromPrismaError } from './lib/errors.js';
import { TenantContextError } from './db/tenant-context.js';
import { InMemoryEventBus, type EventBus } from './events/bus.js';
import { registerCoreSubscribers } from './events/subscribers.js';
import { LocalStorage, getStorage } from './services/storage.js';
import { MAX_UPLOAD_BYTES } from './services/images.js';
import authPlugin from './plugins/auth.js';

import authRoutes from './modules/auth/routes.js';
import restaurantRoutes from './modules/restaurant/routes.js';
import categoryRoutes from './modules/categories/routes.js';
import menuItemRoutes from './modules/menu-items/routes.js';
import ruleRoutes from './modules/availability-rules/routes.js';
import accessPointRoutes from './modules/access-points/routes.js';
import tableRoutes from './modules/tables/routes.js';
import userRoutes from './modules/users/routes.js';
import platformRoutes from './modules/platform/routes.js';
import publicRoutes from './modules/public/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    events: EventBus;
    config: Env;
  }
}

export interface BuildOptions {
  config?: Env;
  logger?: boolean;
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? env();

  const app = Fastify({
    trustProxy: true,
    logger:
      options.logger === false || config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            // Chaque ligne porte le requestId ; le restaurantId est ajouté par le hook plus bas.
            transport:
              config.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
                : undefined,
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password'],
              remove: true,
            },
          },
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
  });

  app.decorate('config', config);
  app.decorate('events', new InMemoryEventBus((error, name) => app.log.error({ err: error, event: name }, 'abonné en échec')));
  registerCoreSubscribers(app.events);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  /* ── Journalisation : restaurantId dans chaque ligne ───────────────────── */
  app.addHook('onRequest', async (request) => {
    request.log = request.log.child({ requestId: request.id });
  });
  app.addHook('preHandler', async (request) => {
    if (request.auth?.restaurantId) {
      request.log = request.log.child({ restaurantId: request.auth.restaurantId });
    }
  });

  /* ── Erreurs : une seule forme de réponse ──────────────────────────────── */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
      return reply.status(error.statusCode).send(error.toResponse());
    }

    if (error instanceof ZodError || (error as { validation?: unknown }).validation) {
      const issues =
        error instanceof ZodError
          ? error.issues
          : ((error as { validation?: unknown }).validation as unknown[]);
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Certaines informations sont incomplètes ou invalides.',
          details: issues,
        },
      });
    }

    const prisma = fromPrismaError(error);
    if (prisma) return reply.status(prisma.statusCode).send(prisma.toResponse());

    if (error instanceof TenantContextError) {
      // Toujours un bug de notre côté : on ne laisse jamais fuir le détail au client.
      request.log.error({ err: error }, 'contexte d’accès manquant');
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' },
      });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans un instant.' },
      });
    }

    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Fichier trop lourd : 8 Mo au maximum.' },
      });
    }

    request.log.error({ err: error }, 'erreur non gérée');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route inconnue : ${request.method} ${request.url}` },
    });
  });

  /* ── Sécurité et transport ─────────────────────────────────────────────── */
  await app.register(cors, {
    origin: [config.ADMIN_URL, config.PUBLIC_MENU_URL],
    credentials: true,
  });

  if (config.RATE_LIMIT_ENABLED) {
    await app.register(rateLimit, { global: false, max: 300, timeWindow: '1 minute' });
  }

  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 8 },
  });

  const storage = getStorage();
  if (storage instanceof LocalStorage) {
    await app.register(fastifyStatic, {
      root: storage.rootPath,
      prefix: `${config.STORAGE_PUBLIC_PREFIX}/`,
      decorateReply: false,
      // Les URL d'images portent le hachage du contenu : elles ne changent jamais sans raison.
      maxAge: '365d',
      immutable: true,
    });
  }

  /* ── OpenAPI ───────────────────────────────────────────────────────────── */
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Evolyx Restaurant — API',
        description:
          "Socle et module Menu QR. Toutes les entités métier sont cloisonnées par restaurant ; " +
          'les routes `/public` sont les seules accessibles sans authentification.',
        version: '1.0.0',
      },
      servers: [{ url: config.API_PUBLIC_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'public', description: 'Menu client — sans authentification, mis en cache' },
        { name: 'auth', description: 'Sessions' },
        { name: 'restaurant', description: 'Identité, charte, horaires' },
        { name: 'menu', description: 'Catégories, plats, règles' },
        { name: 'access-points', description: 'Codes QR' },
        { name: 'tables', description: 'Tables de la salle' },
        { name: 'users', description: 'Comptes du restaurant' },
        { name: 'platform', description: 'Administration de la plateforme' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  /* ── Routes ────────────────────────────────────────────────────────────── */
  await app.register(authPlugin);

  app.get('/health', { schema: { hide: true } }, async () => ({
    status: 'ok',
    version: '1.0.0',
    time: new Date().toISOString(),
  }));

  await app.register(
    async (api) => {
      await api.register(publicRoutes, { prefix: '/public' });
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(restaurantRoutes, { prefix: '/restaurant' });
      await api.register(categoryRoutes, { prefix: '/categories' });
      await api.register(menuItemRoutes, { prefix: '/menu-items' });
      await api.register(ruleRoutes, { prefix: '/availability-rules' });
      await api.register(accessPointRoutes, { prefix: '/access-points' });
      await api.register(tableRoutes, { prefix: '/tables' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(platformRoutes, { prefix: '/platform' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
