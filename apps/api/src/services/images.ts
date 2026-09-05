import sharp from 'sharp';
import { IMAGE_VARIANTS, type PublicImage } from '@evolyx/shared';
import { AppError } from '../lib/errors.js';
import { brandKey, getStorage, hashContent, imageKey } from './storage.js';

/**
 * Traitement des images.
 *
 * Le client final est sur un forfait de données payé au mégaoctet : on ne lui envoie jamais
 * l'original. Chaque envoi produit trois largeurs (160 / 480 / 960) en WebP, plus un JPEG de
 * repli pour les Android anciens. Les dimensions réelles sont conservées afin que le menu
 * puisse réserver la place et éviter tout décalage de mise en page au chargement.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface ProcessedImage {
  storageKey: string;
  variants: PublicImage;
  width: number;
  height: number;
}

function assertAcceptable(buffer: Buffer, mimetype: string): void {
  if (!ACCEPTED.has(mimetype)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Format non pris en charge. Envoyez une image JPEG, PNG, WebP ou AVIF.',
    );
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError('PAYLOAD_TOO_LARGE', 'Image trop lourde : 8 Mo au maximum.');
  }
}

/** Produit les dérivés d'une photo de plat et les range dans le stockage. */
export async function processMenuItemImage(
  buffer: Buffer,
  mimetype: string,
  restaurantId: string,
  itemId: string,
): Promise<ProcessedImage> {
  assertAcceptable(buffer, mimetype);

  const storage = getStorage();
  const hash = hashContent(buffer);
  const source = sharp(buffer, { failOn: 'error' }).rotate(); // respecte l'orientation EXIF
  const meta = await source.metadata();

  if (!meta.width || !meta.height) {
    throw new AppError('VALIDATION_ERROR', "Ce fichier n'est pas une image exploitable.");
  }

  const written: Record<string, string> = {};

  for (const [variant, width] of Object.entries(IMAGE_VARIANTS)) {
    const resized = sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: 'cover', position: 'attention' });

    const webp = await resized.clone().webp({ quality: 78, effort: 4 }).toBuffer();
    const key = imageKey(restaurantId, itemId, hash, variant, 'webp');
    await storage.put(key, webp, 'image/webp');
    written[variant] = storage.url(key);
  }

  // Repli JPEG : une seule taille suffit, elle ne sert qu'aux navigateurs sans WebP.
  const fallback = await sharp(buffer)
    .rotate()
    .resize({ width: IMAGE_VARIANTS.medium, withoutEnlargement: true })
    .jpeg({ quality: 76, progressive: true, mozjpeg: true })
    .toBuffer();
  const fallbackKey = imageKey(restaurantId, itemId, hash, 'medium', 'jpg');
  await storage.put(fallbackKey, fallback, 'image/jpeg');

  const ratio = meta.height / meta.width;

  return {
    storageKey: imageKey(restaurantId, itemId, hash, 'source', 'webp'),
    width: Math.min(meta.width, IMAGE_VARIANTS.large),
    height: Math.round(Math.min(meta.width, IMAGE_VARIANTS.large) * ratio),
    variants: {
      thumb: written.thumb!,
      medium: written.medium!,
      large: written.large!,
      fallback: storage.url(fallbackKey),
      width: Math.min(meta.width, IMAGE_VARIANTS.large),
      height: Math.round(Math.min(meta.width, IMAGE_VARIANTS.large) * ratio),
    },
  };
}

/** Logo : carré, petit, transparent conservé. Il finira aussi au centre des codes QR. */
export async function processLogo(
  buffer: Buffer,
  mimetype: string,
  restaurantId: string,
): Promise<{ key: string; url: string }> {
  assertAcceptable(buffer, mimetype);
  const storage = getStorage();
  const hash = hashContent(buffer);

  const png = await sharp(buffer)
    .rotate()
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const key = brandKey(restaurantId, 'logo', hash, 'png');
  await storage.put(key, png, 'image/png');
  return { key, url: storage.url(key) };
}

/** Couverture : large, compressée franchement — elle est décorative, pas informative. */
export async function processCover(
  buffer: Buffer,
  mimetype: string,
  restaurantId: string,
): Promise<{ key: string; url: string }> {
  assertAcceptable(buffer, mimetype);
  const storage = getStorage();
  const hash = hashContent(buffer);

  // 960 px de large suffisent : la couverture s'affiche sur 520 px au maximum, et c'est
  // elle qui arrive en dernier sur un réseau lent. Chaque kilo-octet s'y voit.
  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: 960, height: 480, fit: 'cover', position: 'attention' })
    .webp({ quality: 68, effort: 5 })
    .toBuffer();

  const key = brandKey(restaurantId, 'cover', hash, 'webp');
  await storage.put(key, webp, 'image/webp');
  return { key, url: storage.url(key) };
}

/**
 * Vignette de démonstration : un dégradé uni tiré de la charte. Sert aux seeds, pour ne
 * dépendre d'aucune photo tierce.
 */
export async function generatePlaceholder(
  from: string,
  to: string,
  width = 960,
  height = 720,
): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}
