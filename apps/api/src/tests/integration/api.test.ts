import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { asSystem, disconnectDb } from '../../db/index.js';
import { clearMenuCache } from '../../modules/public/cache.js';
import { bearer, createTestApp, login } from '../helpers/app.js';
import { TEST_PASSWORD, resetDatabase, seedTestWorld, type TestWorld } from '../helpers/fixtures.js';

/**
 * Tests d'intégration : chaque endpoint en nominal et en erreur.
 * Le décor est celui du test d'isolation — deux restaurants voisins, quatre rôles.
 */

let app: FastifyInstance;
let world: TestWorld;
let adminA = '';
let managerA = '';
let staffA = '';
let adminB = '';
let platform = '';

const API = '/api/v1';

beforeAll(async () => {
  app = await createTestApp();
  await asSystem(async () => resetDatabase());
  world = await seedTestWorld();

  adminA = (await login(app, world.a.adminEmail, TEST_PASSWORD)).token;
  managerA = (await login(app, world.a.managerEmail, TEST_PASSWORD)).token;
  staffA = (await login(app, world.a.staffEmail, TEST_PASSWORD)).token;
  adminB = (await login(app, world.b.adminEmail, TEST_PASSWORD)).token;
  platform = (await login(app, world.platformAdminEmail, TEST_PASSWORD)).token;
});

afterAll(async () => {
  await app.close();
  await disconnectDb();
});

/* ═══════════════════════════════════════════════════════════════════════════
   Sessions
   ═══════════════════════════════════════════════════════════════════════════ */

describe('POST /auth/login', () => {
  it('ouvre une session et pose le cookie de rafraîchissement', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: world.a.adminEmail, password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('accessToken');

    const cookie = (response.cookies as { name: string; httpOnly?: boolean }[]).find(
      (c) => c.name === 'evolyx_refresh',
    );
    expect(cookie?.httpOnly).toBe(true);
  });

  it('ne distingue pas un e-mail inconnu d’un mot de passe faux', async () => {
    const inconnu = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: 'personne@nulle-part.cm', password: TEST_PASSWORD },
    });
    const mauvais = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: world.a.adminEmail, password: 'MotDePasseIncorrect1' },
    });

    expect(inconnu.statusCode).toBe(401);
    expect(mauvais.statusCode).toBe(401);
    expect(inconnu.json()).toEqual(mauvais.json());
  });

  it('refuse une adresse mal formée avec une erreur de validation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: 'pas-une-adresse', password: 'x' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me', () => {
  it('rend l’utilisateur, son restaurant, ses modules et ses capacités', async () => {
    const response = await app.inject({ method: 'GET', url: `${API}/auth/me`, headers: bearer(managerA) });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.user.role).toBe('MANAGER');
    expect(body.restaurant.id).toBe(world.a.id);
    expect(body.modules).toContain('menu_qr');
    expect(body.capabilities).toContain('menu:write');
    expect(body.capabilities).not.toContain('users:write');
  });

  it('refuse sans jeton, et avec un jeton fantaisiste', async () => {
    expect((await app.inject({ method: 'GET', url: `${API}/auth/me` })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `${API}/auth/me`,
          headers: { authorization: 'Bearer nawak' },
        })
      ).statusCode,
    ).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('renouvelle la session et invalide l’ancien jeton', async () => {
    const session = await login(app, world.a.staffEmail, TEST_PASSWORD);

    const first = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: session.cookie! },
    });
    expect(first.statusCode).toBe(200);

    // Rejouer le même jeton doit échouer : il a été consommé.
    const replay = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: session.cookie! },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('refuse sans cookie', async () => {
    const response = await app.inject({ method: 'POST', url: `${API}/auth/refresh` });
    expect(response.statusCode).toBe(401);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Matrice de permissions, éprouvée sur de vraies routes
   ═══════════════════════════════════════════════════════════════════════════ */

describe('permissions par rôle', () => {
  it('STAFF lit la carte mais ne la modifie pas', async () => {
    const lecture = await app.inject({
      method: 'GET',
      url: `${API}/menu-items`,
      headers: bearer(staffA),
    });
    expect(lecture.statusCode).toBe(200);

    const écriture = await app.inject({
      method: 'POST',
      url: `${API}/categories`,
      headers: bearer(staffA),
      payload: { name: { fr: 'Interdit' } },
    });
    expect(écriture.statusCode).toBe(403);
    expect(écriture.json().error.code).toBe('FORBIDDEN');
  });

  it('STAFF peut marquer un plat épuisé — c’est le geste du quotidien', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/menu-items/${world.a.itemId}/status`,
      headers: bearer(staffA),
      payload: { status: 'SOLD_OUT' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('SOLD_OUT');

    await app.inject({
      method: 'PATCH',
      url: `${API}/menu-items/${world.a.itemId}/status`,
      headers: bearer(staffA),
      payload: { status: 'AVAILABLE' },
    });
  });

  it('MANAGER touche à la carte mais pas à la charte ni aux comptes', async () => {
    const carte = await app.inject({
      method: 'POST',
      url: `${API}/categories`,
      headers: bearer(managerA),
      payload: { name: { fr: 'Ajoutée par le gérant' } },
    });
    expect(carte.statusCode).toBe(201);

    const charte = await app.inject({
      method: 'PATCH',
      url: `${API}/restaurant`,
      headers: bearer(managerA),
      payload: { name: 'Renommé par le gérant' },
    });
    expect(charte.statusCode).toBe(403);

    const comptes = await app.inject({
      method: 'GET',
      url: `${API}/users`,
      headers: bearer(managerA),
    });
    expect(comptes.statusCode).toBe(403);
  });

  it('ADMIN administre son restaurant mais pas la plateforme', async () => {
    expect(
      (await app.inject({ method: 'GET', url: `${API}/users`, headers: bearer(adminA) })).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `${API}/platform/restaurants`,
          headers: bearer(adminA),
        })
      ).statusCode,
    ).toBe(403);
  });

  it('PLATFORM_ADMIN voit tous les restaurants', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/platform/restaurants`,
      headers: bearer(platform),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Isolation, vue depuis HTTP
   ═══════════════════════════════════════════════════════════════════════════ */

describe('isolation par les routes', () => {
  it('l’admin de A reçoit 404 sur un plat de B', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/menu-items/${world.b.itemId}`,
      headers: bearer(adminA),
    });
    expect(response.statusCode).toBe(404);
  });

  it('l’admin de A ne peut pas modifier le statut d’un plat de B', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/menu-items/${world.b.itemId}/status`,
      headers: bearer(adminA),
      payload: { status: 'DISABLED' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('la liste des plats de A ne contient jamais ceux de B', async () => {
    const a = await app.inject({ method: 'GET', url: `${API}/menu-items`, headers: bearer(adminA) });
    const b = await app.inject({ method: 'GET', url: `${API}/menu-items`, headers: bearer(adminB) });

    const idsA = a.json().map((item: { id: string }) => item.id);
    const idsB = b.json().map((item: { id: string }) => item.id);
    expect(idsA.some((id: string) => idsB.includes(id))).toBe(false);
  });

  it('l’admin de A ne peut pas désactiver un compte de B', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/users/${world.b.adminId}`,
      headers: bearer(adminA),
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Carte
   ═══════════════════════════════════════════════════════════════════════════ */

describe('catégories et plats', () => {
  let categoryId = '';
  let itemId = '';

  it('crée une catégorie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/categories`,
      headers: bearer(adminA),
      payload: { name: { fr: 'Desserts', en: 'Desserts' }, icon: '🍰' },
    });
    expect(response.statusCode).toBe(201);
    categoryId = response.json().id;
  });

  it('refuse un nom sans français', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/categories`,
      headers: bearer(adminA),
      payload: { name: { en: 'English only' } },
    });
    expect(response.statusCode).toBe(400);
  });

  it('crée un plat à prix unique', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items`,
      headers: bearer(adminA),
      payload: {
        categoryId,
        name: { fr: 'Tiramisu' },
        basePrice: 3000,
        allergens: ['lait', 'oeuf'],
      },
    });
    expect(response.statusCode).toBe(201);
    itemId = response.json().id;
    expect(response.json().basePrice).toBe(3000);
  });

  it('refuse un plat qui a un prix ET des variantes', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items`,
      headers: bearer(adminA),
      payload: {
        categoryId,
        name: { fr: 'Impossible' },
        basePrice: 1000,
        variants: [{ name: { fr: 'Grand' }, price: 2000 }],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.stringify(response.json())).toContain('pas les deux');
  });

  it('refuse un plat sans prix ni variante', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items`,
      headers: bearer(adminA),
      payload: { categoryId, name: { fr: 'Sans prix' } },
    });
    expect(response.statusCode).toBe(400);
  });

  it('accepte un plat à variantes et calcule son « à partir de »', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items`,
      headers: bearer(adminA),
      payload: {
        categoryId,
        name: { fr: 'Glace' },
        variants: [
          { name: { fr: '1 boule' }, price: 700 },
          { name: { fr: '2 boules' }, price: 1200 },
        ],
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().variants).toHaveLength(2);
    expect(response.json().basePrice).toBeNull();
  });

  it('journalise un changement de prix', async () => {
    await app.inject({
      method: 'PATCH',
      url: `${API}/menu-items/${itemId}`,
      headers: bearer(adminA),
      payload: { basePrice: 3500 },
    });

    const audit = await app.inject({
      method: 'GET',
      url: `${API}/restaurant/audit`,
      headers: bearer(adminA),
    });
    const entries = audit.json() as { action: string; entityId: string; diff: unknown }[];
    const priceEntry = entries.find((e) => e.action === 'price.changed' && e.entityId === itemId);

    expect(priceEntry).toBeDefined();
    expect(JSON.stringify(priceEntry?.diff)).toContain('3500');
  });

  it('archive au lieu de supprimer', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/menu-items/${itemId}`,
      headers: bearer(adminA),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().archivedAt).not.toBeNull();

    const encore = await asSystem((db) => db.menuItem.findUnique({ where: { id: itemId } }));
    expect(encore).not.toBeNull(); // la ligne existe toujours en base
  });

  it('refuse d’archiver une catégorie qui contient encore des plats', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/categories/${categoryId}`,
      headers: bearer(adminA),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('CONFLICT');
  });

  it('réordonne les catégories', async () => {
    const before = await app.inject({
      method: 'GET',
      url: `${API}/categories`,
      headers: bearer(adminA),
    });
    const ids = before.json().map((c: { id: string }) => c.id) as string[];

    const response = await app.inject({
      method: 'POST',
      url: `${API}/categories/reorder`,
      headers: bearer(adminA),
      payload: { ids: [...ids].reverse() },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().map((c: { id: string }) => c.id)).toEqual([...ids].reverse());
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Import de menu
   ═══════════════════════════════════════════════════════════════════════════ */

describe('import par collage', () => {
  it('renvoie un aperçu sans rien écrire', async () => {
    const avant = await asSystem((db) => db.menuItem.count());

    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items/import`,
      headers: bearer(adminA),
      payload: { text: 'BOISSONS\nJus de gingembre – 1 000\nEau 500\nSans prix du tout' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().recognised).toBe(2);
    expect(response.json().rejected).toBe(1);
    expect(response.json().categories).toEqual(['Boissons']);

    const après = await asSystem((db) => db.menuItem.count());
    expect(après).toBe(avant);
  });

  it('crée les plats confirmés, dans « À classer » si aucune catégorie n’est donnée', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items/import/commit`,
      headers: bearer(adminA),
      payload: { items: [{ name: 'Café noir', price: 500 }] },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().created).toBe(1);

    const categories = await app.inject({
      method: 'GET',
      url: `${API}/categories`,
      headers: bearer(adminA),
    });
    const noms = categories.json().map((c: { name: { fr: string } }) => c.name.fr);
    expect(noms).toContain('À classer');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Points d'accès
   ═══════════════════════════════════════════════════════════════════════════ */

describe('points d’accès', () => {
  let createdIds: string[] = [];
  let code = '';

  it('crée un lot de tables numérotées', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/access-points`,
      headers: bearer(adminA),
      payload: { kind: 'TABLE', label: 'Table', quantity: 5, startAt: 1 },
    });

    expect(response.statusCode).toBe(201);
    const points = response.json() as { id: string; code: string; label: string; url: string }[];
    expect(points).toHaveLength(5);
    expect(points.map((p) => p.label)).toEqual(['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5']);
    expect(new Set(points.map((p) => p.code)).size).toBe(5);
    expect(points[0]!.url).toContain('/public/q/');

    createdIds = points.map((p) => p.id);
    code = points[2]!.code;
  });

  it('réaffecte une table sans toucher au code — rien à réimprimer', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/access-points/${createdIds[2]}`,
      headers: bearer(adminA),
      payload: { label: 'Table 7' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().label).toBe('Table 7');
    expect(response.json().code).toBe(code);
  });

  it('sert le menu du bon restaurant après réaffectation', async () => {
    const response = await app.inject({ method: 'GET', url: `${API}/public/q/${code}` });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(`/r/${world.a.slug}`);
    expect(response.headers.location).toContain(`t=${code}`);
  });

  it('rend 404 sur un code révoqué, comme sur un code inconnu', async () => {
    await app.inject({
      method: 'POST',
      url: `${API}/access-points/${createdIds[0]}/revoke`,
      headers: bearer(adminA),
    });

    const points = await app.inject({
      method: 'GET',
      url: `${API}/access-points`,
      headers: bearer(adminA),
    });
    const revoked = (points.json() as { id: string }[]).find((p) => p.id === createdIds[0]);
    expect(revoked).toBeUndefined(); // sorti de la liste courante

    const all = await asSystem((db) => db.accessPoint.findUnique({ where: { id: createdIds[0] } }));
    const response = await app.inject({ method: 'GET', url: `${API}/public/q/${all!.code}` });
    expect(response.statusCode).toBe(404);

    const inconnu = await app.inject({ method: 'GET', url: `${API}/public/q/ZZZZZZ` });
    expect(inconnu.statusCode).toBe(404);
    expect(response.json()).toEqual(inconnu.json());
  });

  it('produit un PDF A6 et une planche A4', async () => {
    for (const format of ['a6', 'a4'] as const) {
      const response = await app.inject({
        method: 'GET',
        url: `${API}/access-points/pdf?format=${format}`,
        headers: bearer(adminA),
      });
      expect(response.statusCode, format).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('rend un aperçu SVG du code', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/access-points/${createdIds[1]}/qr.svg`,
      headers: bearer(adminA),
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<svg');
  });

  it('refuse la création à un STAFF', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/access-points`,
      headers: bearer(staffA),
      payload: { kind: 'TABLE', label: 'Table', quantity: 1 },
    });
    expect(response.statusCode).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Menu public
   ═══════════════════════════════════════════════════════════════════════════ */

describe('menu public', () => {
  it('sert le menu avec ETag et cache', async () => {
    clearMenuCache();
    const response = await app.inject({ method: 'GET', url: `${API}/public/r/${world.a.slug}/menu` });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toContain('max-age=60');
    expect(response.headers['cache-control']).toContain('stale-while-revalidate=600');
    expect(response.headers.etag).toBeDefined();

    const conditionnelle = await app.inject({
      method: 'GET',
      url: `${API}/public/r/${world.a.slug}/menu`,
      headers: { 'if-none-match': response.headers.etag as string },
    });
    expect(conditionnelle.statusCode).toBe(304);
  });

  it('ne demande aucune authentification', async () => {
    const response = await app.inject({ method: 'GET', url: `${API}/public/r/${world.a.slug}/menu` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rend 404 sur un slug inconnu', async () => {
    const response = await app.inject({ method: 'GET', url: `${API}/public/r/restaurant-fantome/menu` });
    expect(response.statusCode).toBe(404);
  });

  it('rend 410 quand le restaurant est suspendu', async () => {
    await app.inject({
      method: 'PATCH',
      url: `${API}/platform/restaurants/${world.b.id}`,
      headers: bearer(platform),
      payload: { status: 'SUSPENDED' },
    });

    const menu = await app.inject({ method: 'GET', url: `${API}/public/r/${world.b.slug}/menu` });
    expect(menu.statusCode).toBe(410);
    expect(menu.json().error.code).toBe('RESTAURANT_SUSPENDED');

    const parCode = await app.inject({
      method: 'GET',
      url: `${API}/public/q/${world.b.accessPointCode}`,
    });
    expect(parCode.statusCode).toBe(410);

    // Et la session de son administrateur cesse de fonctionner immédiatement.
    const session = await app.inject({ method: 'GET', url: `${API}/auth/me`, headers: bearer(adminB) });
    expect(session.statusCode).toBe(410);

    await app.inject({
      method: 'PATCH',
      url: `${API}/platform/restaurants/${world.b.id}`,
      headers: bearer(platform),
      payload: { status: 'ACTIVE' },
    });
  });

  it('reflète un changement de statut en moins d’une seconde', async () => {
    clearMenuCache();
    const avant = await app.inject({ method: 'GET', url: `${API}/public/r/${world.a.slug}/menu` });
    const nomAvant = avant.json().moment;

    await app.inject({
      method: 'PATCH',
      url: `${API}/menu-items/${world.a.itemId}/status`,
      headers: bearer(staffA),
      payload: { status: 'SOLD_OUT' },
    });

    const après = await app.inject({ method: 'GET', url: `${API}/public/r/${world.a.slug}/menu` });
    expect(après.json().moment).not.toBe(nomAvant);
    expect(après.json().moment).toContain('Plus de');

    await app.inject({
      method: 'PATCH',
      url: `${API}/menu-items/${world.a.itemId}/status`,
      headers: bearer(staffA),
      payload: { status: 'AVAILABLE' },
    });
  });

  it('accepte une prévisualisation à un instant donné, sans la mettre en cache', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/public/r/${world.a.slug}/menu?at=2026-09-06T10:00:00.000Z`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().generatedAt).toBe('2026-09-06T10:00:00.000Z');
  });

  it('refuse un paramètre « at » invalide', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/public/r/${world.a.slug}/menu?at=hier-soir`,
    });
    expect(response.statusCode).toBe(400);
  });

  it('sert la fiche d’information', async () => {
    const response = await app.inject({ method: 'GET', url: `${API}/public/r/${world.a.slug}/info` });
    expect(response.statusCode).toBe(200);
    expect(response.json().opening.hours).toHaveLength(7);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Restaurant et plateforme
   ═══════════════════════════════════════════════════════════════════════════ */

describe('restaurant', () => {
  it('renvoie la charte dérivée et ses avertissements', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/restaurant`,
      headers: bearer(adminA),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().themePreview.vars['--primary']).toBeDefined();
    expect(response.json().themePreview.contrast.textOnBackground).toBeGreaterThan(1);
  });

  it('accepte une charte peu contrastée mais prévient', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/restaurant`,
      headers: bearer(adminA),
      payload: { theme: { primary: '#EEEEEE', background: '#F2F2F2', fontDisplay: 'inter', cornerRadius: 8 } },
    });

    expect(response.statusCode).toBe(200); // on avertit, on ne bloque pas
    expect(response.json().themePreview.warnings.length).toBeGreaterThan(0);

    await app.inject({
      method: 'PATCH',
      url: `${API}/restaurant`,
      headers: bearer(adminA),
      payload: { theme: { primary: '#FF6A2C', background: '#17130F', fontDisplay: 'fraunces', cornerRadius: 16 } },
    });
  });

  it('remplace les horaires en bloc', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/restaurant`,
      headers: bearer(adminA),
      payload: {
        openingHours: [
          { dayOfWeek: 0, isOpen: false, openTime: '00:00', closeTime: '00:01' },
          { dayOfWeek: 5, isOpen: true, openTime: '11:00', closeTime: '00:30' },
        ],
      },
    });
    expect(response.statusCode).toBe(200);

    const fiche = await app.inject({ method: 'GET', url: `${API}/restaurant`, headers: bearer(adminA) });
    expect(fiche.json().openingHours).toHaveLength(2);
  });

  it('refuse un slug déjà pris', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/restaurant`,
      headers: bearer(adminA),
      payload: { slug: world.b.slug },
    });
    expect(response.statusCode).toBe(409);
  });
});

describe('plateforme', () => {
  it('crée un restaurant et rend un lien d’invitation utilisable une fois', async () => {
    const création = await app.inject({
      method: 'POST',
      url: `${API}/platform/restaurants`,
      headers: bearer(platform),
      payload: {
        name: 'Chez Mado',
        slug: 'chez-mado',
        adminEmail: 'mado@chez-mado.cm',
        adminFullName: 'Mado Ngo',
      },
    });

    expect(création.statusCode).toBe(201);
    const url = création.json().invitation.url as string;
    const token = url.split('/').pop()!;

    const vérification = await app.inject({ method: 'GET', url: `${API}/auth/invite/${token}` });
    expect(vérification.statusCode).toBe(200);
    expect(vérification.json().restaurantName).toBe('Chez Mado');

    const acceptation = await app.inject({
      method: 'POST',
      url: `${API}/auth/invite/accept`,
      payload: { token, password: 'MotDePasseDeMado2026' },
    });
    expect(acceptation.statusCode).toBe(200);
    expect(acceptation.json()).toHaveProperty('accessToken');

    // Le même lien ne doit plus fonctionner.
    const rejeu = await app.inject({
      method: 'POST',
      url: `${API}/auth/invite/accept`,
      payload: { token, password: 'UnAutreMotDePasse2026' },
    });
    expect(rejeu.statusCode).toBe(409);
  });

  it('refuse d’activer un module non livré', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/platform/restaurants/${world.a.id}`,
      headers: bearer(platform),
      payload: { enabledModules: ['core', 'ordering'] },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.stringify(response.json())).toContain('ordering');
  });

  it('coupe l’accès aux codes QR quand le module est désactivé', async () => {
    await app.inject({
      method: 'PATCH',
      url: `${API}/platform/restaurants/${world.a.id}`,
      headers: bearer(platform),
      payload: { enabledModules: ['core'] },
    });

    const refresh = await login(app, world.a.adminEmail, TEST_PASSWORD);
    const response = await app.inject({
      method: 'GET',
      url: `${API}/access-points`,
      headers: bearer(refresh.token),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('MODULE_DISABLED');

    // La carte, elle, reste accessible : elle relève du socle.
    expect(
      (await app.inject({ method: 'GET', url: `${API}/menu-items`, headers: bearer(refresh.token) }))
        .statusCode,
    ).toBe(200);

    await app.inject({
      method: 'PATCH',
      url: `${API}/platform/restaurants/${world.a.id}`,
      headers: bearer(platform),
      payload: { enabledModules: ['core', 'menu_qr'] },
    });
  });
});

describe('routes inconnues', () => {
  it('rendent une erreur normalisée', async () => {
    const response = await app.inject({ method: 'GET', url: `${API}/nawak` });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect(response.json().error.message).toContain('/api/v1/nawak');
  });
});
