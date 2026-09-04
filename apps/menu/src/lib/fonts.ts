import type { DisplayFontKey } from '@evolyx/shared';

/**
 * Chargement des polices.
 *
 * Trois décisions, toutes dictées par le forfait de données du client final :
 *
 *  1. **auto-hébergées** — aucun appel à un CDN Google au moment d'ouvrir le menu : une
 *     résolution DNS de plus sur un réseau lent, c'est une demi-seconde de texte invisible ;
 *  2. **latin seulement** — on ne référence que le sous-ensemble latin de chaque famille.
 *     Les feuilles complètes de Fontsource déclarent cyrillique, grec et vietnamien : le
 *     navigateur ne les téléchargerait pas, mais le service worker, lui, les précacherait —
 *     un mégaoctet imposé au premier chargement, précisément ce qu'on veut éviter ;
 *  3. **à la demande** — le restaurant a choisi *une* police de titre parmi cinq. On ne
 *     télécharge que celle-là, après le premier rendu. Le texte s'affiche aussitôt dans la
 *     police de repli, puis bascule (`font-display: swap`).
 */

interface FontSpec {
  family: string;
  url: () => Promise<{ default: string }>;
  /** Axes variables déclarés à l'enregistrement de la fonte. */
  weight: string;
}

const DISPLAY_FONTS: Record<Exclude<DisplayFontKey, 'system'>, FontSpec> = {
  fraunces: {
    family: 'Fraunces Variable',
    weight: '100 900',
    url: () =>
      import('@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url'),
  },
  bricolage: {
    family: 'Bricolage Grotesque Variable',
    weight: '200 800',
    url: () =>
      import(
        '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url'
      ),
  },
  inter: {
    family: 'Inter Variable',
    weight: '100 900',
    url: () => import('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'),
  },
  lora: {
    family: 'Lora Variable',
    weight: '400 700',
    url: () => import('@fontsource-variable/lora/files/lora-latin-wght-normal.woff2?url'),
  },
};

const BODY_FONT: FontSpec = DISPLAY_FONTS.inter;

const loaded = new Set<string>();

async function register(spec: FontSpec): Promise<void> {
  if (loaded.has(spec.family)) return;
  loaded.add(spec.family);

  try {
    const { default: url } = await spec.url();
    const face = new FontFace(spec.family, `url(${url}) format('woff2-variations')`, {
      weight: spec.weight,
      display: 'swap',
      style: 'normal',
    });
    await face.load();
    document.fonts.add(face);
  } catch {
    // Police indisponible : la pile de repli du thème prend le relais, sans rien casser.
    loaded.delete(spec.family);
  }
}

export function loadDisplayFont(key: DisplayFontKey): Promise<void> {
  // La police système ne coûte rien : c'est aussi pour cela qu'elle est proposée.
  if (key === 'system') return Promise.resolve();
  const spec = DISPLAY_FONTS[key];
  return spec ? register(spec) : Promise.resolve();
}

/** Le corps de texte est toujours Inter : lisibilité d'abord, sur de petits écrans. */
export function loadBodyFont(): Promise<void> {
  return register(BODY_FONT);
}
