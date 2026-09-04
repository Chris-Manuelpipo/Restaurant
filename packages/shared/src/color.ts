/**
 * Primitives couleur, sans dépendance. Utilisées par `deriveTheme()` côté navigateur
 * comme côté serveur (rendu des PDF de QR codes, aperçus).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Analyse `#RGB` ou `#RRGGBB`. Renvoie null plutôt que de lever : l'appelant décide. */
export function parseHex(input: string): Rgb | null {
  const match = HEX_RE.exec(input.trim());
  if (!match) return null;
  let hex = match[1] as string;
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function isValidHex(input: string): boolean {
  return HEX_RE.test(input.trim());
}

const clamp255 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Luminance relative WCAG 2.1. 0 = noir, 1 = blanc. */
export function relativeLuminance(color: Rgb | string): number {
  const rgb = typeof color === 'string' ? parseHex(color) : color;
  if (!rgb) return 0;
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Ratio de contraste WCAG entre deux couleurs, de 1 (identiques) à 21 (noir sur blanc). */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * Mélange linéaire de `from` vers `to`. `amount` = 0 renvoie `from`, 1 renvoie `to`.
 * Volontairement en espace sRGB : c'est ce que fait le navigateur pour un dégradé simple,
 * donc l'aperçu du back-office et le rendu final concordent exactement.
 */
export function mix(from: Rgb | string, to: Rgb | string, amount: number): Rgb {
  const a = typeof from === 'string' ? (parseHex(from) ?? { r: 0, g: 0, b: 0 }) : from;
  const b = typeof to === 'string' ? (parseHex(to) ?? { r: 0, g: 0, b: 0 }) : to;
  const t = Math.min(1, Math.max(0, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export const mixHex = (from: Rgb | string, to: Rgb | string, amount: number): string =>
  toHex(mix(from, to, amount));

/** Choisit entre noir et blanc celui qui contraste le mieux avec la couleur donnée. */
export function bestForeground(background: Rgb | string): 'black' | 'white' {
  return contrastRatio(background, WHITE) >= contrastRatio(background, BLACK) ? 'white' : 'black';
}
