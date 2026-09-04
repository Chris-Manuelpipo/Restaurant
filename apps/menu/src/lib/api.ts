import type { PublicMenuResponse } from '@evolyx/shared';

/**
 * Accès à l'API publique.
 *
 * Une seule requête donne tout le menu — c'est la règle. Sur une connexion lente, chaque
 * aller-retour supplémentaire est une seconde d'attente devant un écran vide.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3010';

export class MenuNotFound extends Error {}
export class MenuUnavailable extends Error {}

export async function fetchMenu(slug: string, locale?: string): Promise<PublicMenuResponse> {
  const url = new URL(`/api/v1/public/r/${encodeURIComponent(slug)}/menu`, API_URL);
  if (locale) url.searchParams.set('locale', locale);

  const response = await fetch(url, { headers: { accept: 'application/json' } });

  if (response.status === 404) throw new MenuNotFound('Ce restaurant est introuvable.');
  if (response.status === 410) {
    throw new MenuUnavailable("Ce menu n'est plus disponible. Contactez le restaurant.");
  }
  if (!response.ok) throw new Error(`Le menu n'a pas pu être chargé (${response.status}).`);

  return absolutiseMedia((await response.json()) as PublicMenuResponse);
}

/**
 * L'API renvoie des chemins de média relatifs (`/media/…`) : ils sont indépendants du domaine
 * qui les sert, ce qui permet de basculer sur un S3 sans réécrire la base. Le menu, lui, est
 * servi depuis une autre origine que l'API — on les résout donc à la réception, une fois,
 * plutôt que dans chaque composant.
 */
export function mediaUrl(path: string | null): string | null {
  if (!path) return path;
  return path.startsWith('/') ? new URL(path, API_URL).toString() : path;
}

function absolutiseMedia(menu: PublicMenuResponse): PublicMenuResponse {
  menu.restaurant.logoUrl = mediaUrl(menu.restaurant.logoUrl);
  menu.restaurant.coverUrl = mediaUrl(menu.restaurant.coverUrl);

  for (const category of menu.categories) {
    for (const item of category.items) {
      for (const image of item.images) {
        image.thumb = mediaUrl(image.thumb)!;
        image.medium = mediaUrl(image.medium)!;
        image.large = mediaUrl(image.large)!;
        image.fallback = mediaUrl(image.fallback)!;
      }
    }
  }
  return menu;
}

/**
 * Dernière réponse connue, gardée en local.
 *
 * Workbox met déjà la requête en cache ; ce doublon sert au cas où le service worker n'a pas
 * encore pris la main — première visite interrompue, navigateur qui les refuse, mode privé.
 * C'est aussi lui qui date le bandeau « menu enregistré le … ».
 */
const STORAGE_KEY = 'evolyx:menu';

interface Snapshot {
  slug: string;
  locale: string;
  savedAt: string;
  payload: PublicMenuResponse;
}

export function saveSnapshot(slug: string, locale: string, payload: PublicMenuResponse): void {
  try {
    const snapshot: Snapshot = { slug, locale, savedAt: new Date().toISOString(), payload };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Stockage plein ou refusé : le menu fonctionne quand même, simplement sans hors-ligne.
  }
}

export function readSnapshot(slug: string, locale: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Snapshot;
    return snapshot.slug === slug && snapshot.locale === locale ? snapshot : null;
  } catch {
    return null;
  }
}
