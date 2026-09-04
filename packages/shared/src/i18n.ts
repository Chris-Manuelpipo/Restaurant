import { DEFAULT_LOCALE, type Locale } from './constants.js';

/**
 * Un champ traduisible tel qu'il est stocké en base : `{ fr: "Poulet braisé", en: "Grilled chicken" }`.
 * Le français est obligatoire côté écriture (voir les schémas Zod) ; à la lecture on reste
 * tolérant, parce qu'une donnée importée peut toujours être incomplète.
 */
export type I18nText = Partial<Record<Locale, string>> & Record<string, string | undefined>;

/**
 * Résout un champ i18n dans la langue demandée, avec repli **champ par champ**.
 *
 * Le repli est délibérément granulaire : un plat peut avoir un nom traduit et une description
 * qui ne l'est pas. On affiche alors le nom anglais et la description française plutôt que de
 * basculer toute la fiche dans une seule langue.
 *
 * @param field   le champ stocké (objet, chaîne brute, null…)
 * @param locale  la langue demandée
 * @param fallback la langue de repli, français par défaut
 */
export function resolveI18n(
  field: I18nText | string | null | undefined,
  locale: string = DEFAULT_LOCALE,
  fallback: string = DEFAULT_LOCALE,
): string {
  if (field == null) return '';

  // Tolérance : d'anciennes données ou un import peuvent contenir une chaîne nue.
  if (typeof field === 'string') return field;
  if (typeof field !== 'object') return '';

  const wanted = field[locale];
  if (typeof wanted === 'string' && wanted.trim() !== '') return wanted;

  const fell = field[fallback];
  if (typeof fell === 'string' && fell.trim() !== '') return fell;

  // Dernier recours : la première valeur non vide, dans l'ordre de déclaration.
  for (const value of Object.values(field)) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}

/** Vrai si le champ porte une valeur exploitable dans la langue demandée, sans repli. */
export function hasTranslation(field: I18nText | null | undefined, locale: string): boolean {
  if (!field || typeof field !== 'object') return false;
  const value = field[locale];
  return typeof value === 'string' && value.trim() !== '';
}

/** Construit un champ i18n en écartant les traductions vides. */
export function makeI18n(values: Record<string, string | null | undefined>): I18nText {
  const out: I18nText = {};
  for (const [locale, value] of Object.entries(values)) {
    if (typeof value === 'string' && value.trim() !== '') out[locale] = value.trim();
  }
  return out;
}

/**
 * Réduit un objet i18n à une chaîne, pour les payloads publics : le client final reçoit du
 * texte déjà résolu, pas des objets de traduction — c'est autant d'octets en moins sur mobile.
 */
export function flattenI18n<T extends Record<string, unknown>>(
  input: T,
  keys: (keyof T)[],
  locale: string,
  fallback: string = DEFAULT_LOCALE,
): T {
  const out = { ...input };
  for (const key of keys) {
    const raw = input[key];
    if (raw != null && typeof raw === 'object') {
      out[key] = resolveI18n(raw as I18nText, locale, fallback) as T[keyof T];
    }
  }
  return out;
}
