import { createContext, useContext } from 'react';

/**
 * Traduction de l'habillage du menu.
 *
 * Le **contenu** — noms de plats, descriptions, bandeau, horaires — arrive déjà traduit du
 * serveur : le téléphone ne trie aucun objet de traduction. Il ne reste ici que vingt-cinq
 * mots d'interface.
 *
 * Une bibliothèque de traduction complète coûterait quatorze kilo-octets transférés pour ces
 * vingt-cinq mots, sur la page dont tout l'enjeu est d'apparaître vite : à quatre cents
 * kilobits par seconde, c'est un quart de seconde de plus avant que la carte ne s'affiche.
 * Le back-office, lui, garde i18next — il a des centaines de chaînes et aucun budget serré.
 *
 * Voir docs/PERFORMANCE.md pour la mesure qui a motivé ce choix.
 */

const DICTIONARY = {
  fr: {
    soldOut: 'Épuisé',
    from: 'à partir de',
    closed: 'Fermé',
    open: 'Ouvert',
    offlineSaved: 'Hors ligne — menu enregistré le {date}',
    required: 'Obligatoire',
    optional: 'Facultatif',
    size: 'Taille',
    supplements: 'Suppléments',
    allergens: 'Allergènes',
    price: 'Prix',
    orderWithServer: 'Commandez auprès de votre serveur.',
    findUs: 'Nous trouver',
    hours: 'Horaires',
    call: 'Appeler',
    whatsapp: 'WhatsApp',
    directions: 'Itinéraire',
    servedBy: 'Menu servi par',
    loading: 'Chargement du menu…',
    notFound: 'Ce menu est introuvable.',
    notFoundHelp: 'Vérifiez le code de votre table, ou demandez à un serveur.',
    retry: 'Réessayer',
    perPerson: 'par personne',
    minutes: '≈ {count} min',
    closeSheet: 'Fermer',
    table: 'Table',
  },
  en: {
    soldOut: 'Sold out',
    from: 'from',
    closed: 'Closed',
    open: 'Open',
    offlineSaved: 'Offline — menu saved on {date}',
    required: 'Required',
    optional: 'Optional',
    size: 'Size',
    supplements: 'Extras',
    allergens: 'Allergens',
    price: 'Price',
    orderWithServer: 'Order with your server.',
    findUs: 'Find us',
    hours: 'Opening hours',
    call: 'Call',
    whatsapp: 'WhatsApp',
    directions: 'Directions',
    servedBy: 'Menu served by',
    loading: 'Loading the menu…',
    notFound: 'This menu could not be found.',
    notFoundHelp: 'Check your table code, or ask a member of staff.',
    retry: 'Try again',
    perPerson: 'per person',
    minutes: '≈ {count} min',
    closeSheet: 'Close',
    table: 'Table',
  },
} as const;

export type Locale = keyof typeof DICTIONARY;
export type TranslationKey = keyof (typeof DICTIONARY)['fr'];
export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Repli sur le français, comme partout ailleurs dans la plateforme. */
export function translate(
  locale: string,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const table = DICTIONARY[(locale.slice(0, 2) as Locale) in DICTIONARY ? (locale.slice(0, 2) as Locale) : 'fr'];
  let text: string = table[key] ?? DICTIONARY.fr[key] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

const LocaleContext = createContext<string>('fr');
export const LocaleProvider = LocaleContext.Provider;

export function useTranslation(): { t: Translate; locale: string } {
  const locale = useContext(LocaleContext);
  return {
    locale,
    t: (key, params) => translate(locale, key, params),
  };
}

export const DAY_NAMES: Record<string, string[]> = {
  fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
