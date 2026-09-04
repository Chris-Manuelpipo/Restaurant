import { parseAmount } from '@evolyx/shared';
import type { MenuImportPreview, MenuImportRow } from '@evolyx/shared';

/**
 * Lecture d'une carte collée depuis WhatsApp, un tableur ou un document Word.
 *
 * Le parseur accepte ce que les gens écrivent vraiment :
 *   Poulet braisé – 4 500        Poulet DG - 6000 FCFA
 *   Brochettes : 1000            Côtelettes  3.500 F
 *
 * Il reconnaît aussi les titres de section en majuscules comme des catégories. Les lignes
 * qu'il ne comprend pas sont renvoyées **telles quelles**, jamais devinées : le gérant
 * corrige à la main, ce qui vaut mieux qu'un prix inventé.
 */

/** Séparateurs explicites, du plus au moins spécifique. Les tirets typographiques comptent. */
const SEPARATORS = ['—', '–', '-', ':', '=', '·', '|', '\t'];

/** Une ligne de titre : pas de prix, courte, et écrite en capitales ou terminée par « : ». */
function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim().replace(/[:：]\s*$/, '');
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  if (/\d/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

/** Repère le prix en fin de ligne, avec ou sans devise, avec ou sans séparateur de milliers. */
const TRAILING_PRICE = /([0-9][0-9\s  .,']*)\s*(fcfa|xaf|cfa|frs|fr|f)?\s*$/i;

export function parseMenuText(text: string): MenuImportPreview {
  const rows: MenuImportRow[] = [];
  const categories: string[] = [];
  let currentCategory: string | null = null;

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;

    if (looksLikeHeading(line)) {
      currentCategory = titleCase(line.replace(/[:：]\s*$/, '').trim());
      if (!categories.includes(currentCategory)) categories.push(currentCategory);
      return;
    }

    const parsed = parseLine(line);
    if (parsed) {
      rows.push({
        line: index + 1,
        raw,
        ok: true,
        name: parsed.name,
        price: parsed.price,
        categoryName: currentCategory,
        reason: null,
      });
      return;
    }

    rows.push({
      line: index + 1,
      raw,
      ok: false,
      name: cleanName(line) || null,
      price: null,
      categoryName: currentCategory,
      reason: 'Aucun prix reconnu sur cette ligne.',
    });
  });

  return {
    rows,
    recognised: rows.filter((r) => r.ok).length,
    rejected: rows.filter((r) => !r.ok).length,
    categories,
  };
}

interface ParsedLine {
  name: string;
  price: number;
}

export function parseLine(line: string): ParsedLine | null {
  // 1. Séparateur explicite : tout ce qui suit le dernier séparateur doit être un prix.
  for (const separator of SEPARATORS) {
    const at = line.lastIndexOf(separator);
    if (at <= 0) continue;
    const left = line.slice(0, at);
    const right = line.slice(at + separator.length);
    const price = parseAmount(right);
    if (price !== null && price > 0) {
      const name = cleanName(left);
      if (name) return { name, price };
    }
  }

  // 2. Pas de séparateur : le prix est collé en fin de ligne (« Côtelettes 3.500 F »).
  const match = TRAILING_PRICE.exec(line);
  if (match && match[1]) {
    const price = parseAmount(match[1]);
    const name = cleanName(line.slice(0, match.index));
    // Un nombre seul, ou un nom trop court, ne fait pas un plat.
    if (price !== null && price > 0 && name.length >= 2) {
      return { name, price };
    }
  }

  return null;
}

function cleanName(value: string): string {
  return value
    .replace(/^[\s\p{P}]*(?<![\p{L}\d])/u, '')
    .replace(/[\s.·•\-–—:]+$/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** « GRILLADES » → « Grillades » : les cartes sont écrites en capitales, pas les catégories. */
function titleCase(value: string): string {
  const lower = value.toLocaleLowerCase('fr');
  return lower.charAt(0).toLocaleUpperCase('fr') + lower.slice(1);
}
