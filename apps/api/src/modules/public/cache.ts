import { createHash } from 'node:crypto';

/**
 * Cache du menu public.
 *
 * Une salle qui se remplit, c'est vingt scans en deux minutes sur exactement la même carte.
 * On garde donc la réponse en mémoire un court instant, et on l'invalide dès qu'un événement
 * la périme — le gérant qui marque un plat épuisé doit voir l'effet en moins de 60 secondes,
 * pas au bout du TTL.
 *
 * En mémoire volontairement : une instance unique suffit au lot 1, et l'interface est assez
 * étroite pour passer à Redis le jour où plusieurs instances tourneront.
 */

interface Entry {
  etag: string;
  body: string;
  storedAt: number;
  expiresAt: number;
}

const TTL_MS = 30_000;

const entries = new Map<string, Entry>();
/** slug → restaurantId, pour invalider par restaurant sans reconsulter la base. */
const byRestaurant = new Map<string, Set<string>>();

export function cacheKey(slug: string, locale: string): string {
  return `${slug}::${locale}`;
}

export function readMenuCache(key: string): Entry | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return undefined;
  }
  return entry;
}

export function writeMenuCache(
  key: string,
  restaurantId: string,
  body: string,
  ttlMs = TTL_MS,
): Entry {
  const entry: Entry = {
    etag: computeEtag(body),
    body,
    storedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  entries.set(key, entry);

  const keys = byRestaurant.get(restaurantId) ?? new Set();
  keys.add(key);
  byRestaurant.set(restaurantId, keys);

  return entry;
}

/** Appelée par les abonnés du bus d'événements. */
export function invalidateMenuCache(restaurantId: string): void {
  const keys = byRestaurant.get(restaurantId);
  if (!keys) return;
  for (const key of keys) entries.delete(key);
  byRestaurant.delete(restaurantId);
}

export function clearMenuCache(): void {
  entries.clear();
  byRestaurant.clear();
}

export function computeEtag(body: string): string {
  return `W/"${createHash('sha1').update(body).digest('base64url')}"`;
}
