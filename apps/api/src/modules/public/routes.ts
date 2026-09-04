import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { PUBLIC_MENU_MAX_AGE, PUBLIC_MENU_SWR } from '@evolyx/shared';
import { asSystem } from '../../db/index.js';
import { AppError, notFound } from '../../lib/errors.js';
import { menuUrlFor } from '../../config/env.js';
import { normaliseAccessCode } from '../../domain/access-code.js';
import { buildPublicInfo, buildPublicMenu } from './service.js';
import { cacheKey, computeEtag, readMenuCache, writeMenuCache } from './cache.js';

/**
 * Routes publiques : ni cookie, ni session, ni en-tête d'authentification.
 *
 * Ce sont les seules que verra un client final. Elles doivent être rapides, cacheables, et
 * ne jamais divulguer autre chose que ce qu'un menu affiché en salle divulgue déjà.
 */
const publicRoutes: FastifyPluginAsync = async (app) => {
  /* ── Redirection d'un code imprimé ──────────────────────────────────────
     Le code est immuable ; c'est ici, et seulement ici, que se résout
     l'adresse réelle du menu. Changer de domaine ne réimprime rien.        */
  app.get(
    '/q/:code',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['public'],
        summary: 'Redirige un code QR vers le menu du restaurant',
        params: z.object({ code: z.string().min(4).max(12) }),
        response: {
          302: z.null(),
          404: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
          410: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const normalised = normaliseAccessCode(code);

      const point = await asSystem((db) =>
        db.accessPoint.findUnique({
          where: { code: normalised },
          select: {
            isActive: true,
            revokedAt: true,
            label: true,
            restaurant: { select: { slug: true, status: true } },
          },
        }),
      );

      if (!point) throw notFound('Ce code');
      if (!point.isActive || point.revokedAt !== null) {
        // Un code révoqué est traité comme inconnu : on ne renseigne pas un curieux.
        throw notFound('Ce code');
      }
      if (point.restaurant.status === 'SUSPENDED') {
        throw new AppError(
          'RESTAURANT_SUSPENDED',
          "Ce menu n'est plus disponible. Contactez le restaurant.",
        );
      }

      const url = new URL(menuUrlFor(point.restaurant.slug, app.config));
      // La table voyage dans l'URL : le module Commande s'en servira, le menu l'affiche en pied.
      url.searchParams.set('t', normalised);

      return reply
        .header('Cache-Control', 'public, max-age=300')
        .redirect(url.toString(), 302);
    },
  );

  /* ── Le menu complet, en une requête ───────────────────────────────────── */
  app.get(
    '/r/:slug/menu',
    {
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
      schema: {
        tags: ['public'],
        summary: 'Menu complet du restaurant à un instant donné',
        params: z.object({ slug: z.string().min(3).max(48) }),
        querystring: z.object({
          locale: z.string().min(2).max(5).optional(),
          /** Prévisualisation du gérant et tests ; jamais utilisé par le menu client. */
          at: z.string().datetime().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { locale, at } = request.query as { locale?: string; at?: string };

      // Une prévisualisation à un instant choisi ne doit jamais polluer le cache partagé.
      const simulated = at ? new Date(at) : undefined;
      if (simulated && Number.isNaN(simulated.getTime())) {
        throw new AppError('VALIDATION_ERROR', "Le paramètre « at » n'est pas une date valide.");
      }

      if (!simulated) {
        const key = cacheKey(slug, locale ?? 'default');
        const cached = readMenuCache(key);
        if (cached) {
          if (request.headers['if-none-match'] === cached.etag) {
            return reply
              .header('ETag', cached.etag)
              .header('Cache-Control', cacheHeader())
              .status(304)
              .send();
          }
          return reply
            .header('ETag', cached.etag)
            .header('Cache-Control', cacheHeader())
            .header('Content-Type', 'application/json; charset=utf-8')
            .send(cached.body);
        }

        const payload = await buildPublicMenu({ slug, locale });
        const body = JSON.stringify(payload);
        const entry = writeMenuCache(key, payload.restaurant.id, body);

        if (request.headers['if-none-match'] === entry.etag) {
          return reply.header('ETag', entry.etag).header('Cache-Control', cacheHeader()).status(304).send();
        }
        return reply
          .header('ETag', entry.etag)
          .header('Cache-Control', cacheHeader())
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(body);
      }

      const payload = await buildPublicMenu({ slug, locale, at: simulated });
      const body = JSON.stringify(payload);
      return reply
        .header('ETag', computeEtag(body))
        .header('Cache-Control', 'no-store')
        .header('Content-Type', 'application/json; charset=utf-8')
        .send(body);
    },
  );

  /* ── Fiche d'information ───────────────────────────────────────────────── */
  app.get(
    '/r/:slug/info',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['public'],
        summary: 'Coordonnées, horaires et état d’ouverture',
        params: z.object({ slug: z.string().min(3).max(48) }),
        querystring: z.object({ locale: z.string().min(2).max(5).optional() }),
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { locale } = request.query as { locale?: string };
      const payload = await buildPublicInfo(slug, locale);
      return reply.header('Cache-Control', cacheHeader()).send(payload);
    },
  );
};

const cacheHeader = (): string =>
  `public, max-age=${PUBLIC_MENU_MAX_AGE}, stale-while-revalidate=${PUBLIC_MENU_SWR}`;

export default publicRoutes;
