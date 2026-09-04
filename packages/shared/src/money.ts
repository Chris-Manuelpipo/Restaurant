/**
 * Le franc CFA ne connaît pas de sous-unité : tout montant est un entier de francs.
 * Aucune division, aucun flottant, aucun arrondi nulle part dans le code.
 */

const NBSP = '\u00A0';

export const CURRENCY_SYMBOLS: Record<string, { short: string; long: string }> = {
  XAF: { short: 'F', long: 'FCFA' },
  XOF: { short: 'F', long: 'FCFA' },
  EUR: { short: '€', long: 'EUR' },
  USD: { short: '$', long: 'USD' },
};

export function currencySymbol(currency = 'XAF', form: 'short' | 'long' = 'short'): string {
  return (CURRENCY_SYMBOLS[currency] ?? { short: currency, long: currency })[form];
}

/** `4500` → `"4 500"` (espace insécable, pour que le prix ne se coupe jamais en fin de ligne). */
export function formatAmount(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${grouped}`;
}

/** `4500` → `"4 500 F"`. */
export function formatMoney(
  amount: number,
  currency = 'XAF',
  form: 'short' | 'long' = 'short',
): string {
  return `${formatAmount(amount)}${NBSP}${currencySymbol(currency, form)}`;
}

/**
 * Analyse un prix saisi ou collé : `"4 500"`, `"4.500 FCFA"`, `"6000F"`, `"2,500"`.
 * Le point et la virgule sont traités comme séparateurs de milliers — dans une carte de
 * restaurant camerounais, « 3.500 » vaut trois mille cinq cents, jamais trois virgule cinq.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input
    .replace(/(fcfa|xaf|cfa|frs?|f\b)/gi, '')
    .replace(/[\s.,']/g, '')
    .trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}
