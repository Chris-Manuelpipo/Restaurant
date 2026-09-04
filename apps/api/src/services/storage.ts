import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { env } from '../config/env.js';

/**
 * Stockage de fichiers, derrière une interface.
 *
 * Le code métier ne connaît que des **clés opaques** (`menu-items/xxx/thumb.webp`) : il
 * n'écrit jamais de chemin de disque ni d'URL. Passer sur S3 revient à fournir une autre
 * implémentation de `StorageAdapter` — aucune ligne du reste de l'API ne bouge.
 */
export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Supprime tout un préfixe — les dérivés d'une image, par exemple. */
  deletePrefix(prefix: string): Promise<void>;
  /** URL publique servie au navigateur. */
  url(key: string): string;
  exists(key: string): Promise<boolean>;
}

/** Stockage sur disque local. Suffisant pour un VPS unique ; remplaçable sans préavis. */
export class LocalStorage implements StorageAdapter {
  private readonly root: string;
  private readonly publicPrefix: string;

  constructor(root: string, publicPrefix: string) {
    this.root = resolve(root);
    this.publicPrefix = publicPrefix.replace(/\/$/, '');
  }

  /**
   * Résout une clé en chemin absolu, en refusant tout ce qui sortirait de la racine.
   * Une clé vient parfois d'une donnée en base : on ne lui fait pas confiance.
   */
  private pathFor(key: string): string {
    const clean = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const full = resolve(this.root, clean);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Clé de stockage refusée : « ${key} »`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.pathFor(prefix), { recursive: true, force: true });
  }

  url(key: string): string {
    return `${this.publicPrefix}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await readFile(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Racine servie en statique par Fastify. */
  get rootPath(): string {
    return this.root;
  }
}

let adapter: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (!adapter) {
    const config = env();
    adapter = new LocalStorage(
      join(process.cwd(), config.STORAGE_LOCAL_PATH),
      config.STORAGE_PUBLIC_PREFIX,
    );
  }
  return adapter;
}

/** Injection utilisée par les tests. */
export function setStorage(custom: StorageAdapter): void {
  adapter = custom;
}

/**
 * Clé d'un dérivé d'image. Le hachage du contenu sert de nom : deux envois du même fichier
 * ne dupliquent rien, et l'URL peut être mise en cache indéfiniment — elle change avec le
 * contenu, jamais autrement.
 */
export function imageKey(
  restaurantId: string,
  itemId: string,
  contentHash: string,
  variant: string,
  extension: string,
): string {
  return `restaurants/${restaurantId}/menu-items/${itemId}/${contentHash}-${variant}.${extension}`;
}

export function hashContent(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

export function brandKey(restaurantId: string, kind: 'logo' | 'cover', hash: string, ext: string): string {
  return `restaurants/${restaurantId}/${kind}-${hash}.${ext}`;
}
