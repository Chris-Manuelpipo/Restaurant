import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';
import { asSystem, disconnectDb } from '../../db/index.js';
import { bearer, createTestApp, login } from '../helpers/app.js';
import { TEST_PASSWORD, resetDatabase, seedTestWorld, type TestWorld } from '../helpers/fixtures.js';

/**
 * Ce que les autres suites ne peuvent pas éprouver : la limitation de débit (qu'elles
 * désactivent pour ne pas se limiter elles-mêmes) et le traitement des images.
 */

const API = '/api/v1';

let world: TestWorld;

beforeAll(async () => {
  await asSystem(async () => resetDatabase());
  world = await seedTestWorld();
});

afterAll(async () => {
  await disconnectDb();
});

describe('limitation de débit', () => {
  /**
   * Le compteur est tenu par adresse IP, pas par compte : cette suite monte donc sa propre
   * instance, sans quoi elle épuiserait le quota des autres tests.
   */
  let limited: FastifyInstance;

  beforeAll(async () => {
    limited = await createTestApp({ RATE_LIMIT_ENABLED: 'true' });
  });
  afterAll(async () => {
    await limited.close();
  });

  it('coupe les tentatives de connexion en rafale', async () => {
    const codes: number[] = [];
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const response = await limited.inject({
        method: 'POST',
        url: `${API}/auth/login`,
        payload: { email: world.a.adminEmail, password: 'MauvaisMotDePasse2026' },
      });
      codes.push(response.statusCode);
    }

    // Dix tentatives par minute : les suivantes doivent être refusées.
    expect(codes.filter((code) => code === 429).length).toBeGreaterThan(0);
    expect(codes[0]).toBe(401);
  });
});

describe('photos de plat', () => {
  let app: FastifyInstance;
  let token = '';

  beforeAll(async () => {
    app = await createTestApp();
    token = (await login(app, world.b.adminEmail, TEST_PASSWORD)).token;
  });
  afterAll(async () => {
    await app.close();
  });

  const jpeg = async (width: number, height: number): Promise<Buffer> =>
    sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 90, b: 40 } },
    })
      .jpeg()
      .toBuffer();

  const multipart = (
    file: Buffer,
    filename: string,
    contentType: string,
  ): { payload: Buffer; headers: Record<string, string> } => {
    const boundary = '----evolyxtest';
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    return {
      payload: Buffer.concat([head, file, tail]),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    };
  };

  it('génère les trois largeurs et le repli JPEG', async () => {
    const { payload, headers } = multipart(await jpeg(1600, 1200), 'plat.jpg', 'image/jpeg');

    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items/${world.b.itemId}/images`,
      headers: { ...headers, ...bearer(token) },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const images = response.json().images as {
      variants: { thumb: string; medium: string; large: string; fallback: string; width: number };
    }[];

    expect(images).toHaveLength(1);
    const variants = images[0]!.variants;
    expect(variants.thumb).toContain('.webp');
    expect(variants.medium).toContain('.webp');
    expect(variants.large).toContain('.webp');
    expect(variants.fallback).toContain('.jpg');
    // Les dimensions accompagnent l'image : le menu réserve la place, sans décalage au chargement.
    expect(variants.width).toBe(960);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const { payload, headers } = multipart(
      Buffer.from('ceci est un texte'),
      'note.txt',
      'text/plain',
    );

    const response = await app.inject({
      method: 'POST',
      url: `${API}/menu-items/${world.b.itemId}/images`,
      headers: { ...headers, ...bearer(token) },
      payload,
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('retire une photo et la fait disparaître du menu public', async () => {
    const item = await app.inject({
      method: 'GET',
      url: `${API}/menu-items/${world.b.itemId}`,
      headers: bearer(token),
    });
    const imageId = item.json().images[0].id as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/menu-items/${world.b.itemId}/images/${imageId}`,
      headers: bearer(token),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().images).toHaveLength(0);
  });
});
