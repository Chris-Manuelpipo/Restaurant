import { randomInt } from 'node:crypto';
import { ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH } from '@evolyx/shared';

/**
 * Codes d'accès imprimés sur les tables.
 *
 * Trois exigences, dans cet ordre :
 *  - **immuable** : une fois collé sous une table, le code ne change jamais. Toute la
 *    variabilité (nom du restaurant, domaine, affectation de la table) se résout côté serveur ;
 *  - **non ambigu** : ni I, ni L, ni O, ni 0, ni 1 — un client qui recopie le code à la main
 *    depuis une affiche ne doit pas hésiter ;
 *  - **imprévisible** : tiré de `crypto`, pas de `Math.random()`. Deviner le code d'une table
 *    voisine ne doit pas être un jeu.
 */

const ALPHABET = ACCESS_CODE_ALPHABET;

export function generateAccessCode(length = ACCESS_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

const CODE_RE = new RegExp(`^[${ALPHABET}]{${ACCESS_CODE_LENGTH}}$`);

export function isValidAccessCode(code: string): boolean {
  return CODE_RE.test(code);
}

/**
 * Redresse un code saisi à la main.
 *
 * L'alphabet exclut I, L, O, 0 et 1 : si l'un d'eux est tapé, c'est forcément une lecture
 * approximative d'un caractère voisin. On corrige donc dans le seul sens qui ait du sens —
 * du caractère absent vers le caractère présent qui lui ressemble.
 */
const LOOKALIKES: Record<string, string> = { O: 'Q', '0': 'Q', I: 'J', L: 'J', '1': '7' };

export function normaliseAccessCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[OIL01]/g, (char) => LOOKALIKES[char] ?? char);
}

/**
 * Tire un lot de codes distincts. Les collisions avec la base sont traitées par l'appelant,
 * qui réessaie : l'unicité finale est garantie par la contrainte `@unique`, pas par l'espoir.
 */
export function generateAccessCodes(count: number, length = ACCESS_CODE_LENGTH): string[] {
  const codes = new Set<string>();
  let guard = 0;
  while (codes.size < count && guard < count * 50) {
    codes.add(generateAccessCode(length));
    guard += 1;
  }
  return [...codes];
}

/** Nombre de codes possibles — sert à documenter la marge avant collision. */
export const CODE_SPACE = ALPHABET.length ** ACCESS_CODE_LENGTH;
