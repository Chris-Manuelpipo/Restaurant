import i18next, { type i18n as I18nInstance } from 'i18next';

/**
 * Traduction côté serveur.
 *
 * Le bandeau du moment et l'état d'ouverture sont composés par l'API, pas par le client :
 * une seule requête doit suffire à peindre le menu, sans que le téléphone ait à recomposer
 * des phrases. Les chaînes vivent donc ici, en un seul endroit.
 */

export type Translator = (key: string, params?: Record<string, unknown>) => string;

const resources = {
  fr: {
    translation: {
      opening: {
        closesAt: 'ferme à {{time}}',
        opensAt: 'ouvre à {{time}}',
        opensTomorrow: 'ouvre demain à {{time}}',
        opensOnDay: 'ouvre {{day}} à {{time}}',
      },
      moment: {
        promoUntil: '{{label}} jusqu’à {{time}}.',
        promo: '{{label}}.',
        runningLow_one: '{{name}} touche à sa fin.',
        runningLow_other: '{{count}} plats touchent à leur fin.',
        soldOut_one: '{{name}} est épuisé.',
        soldOut_other: '{{count}} plats sont épuisés.',
        allAvailable: 'Tout le menu est disponible.',
      },
    },
  },
  en: {
    translation: {
      opening: {
        closesAt: 'closes at {{time}}',
        opensAt: 'opens at {{time}}',
        opensTomorrow: 'opens tomorrow at {{time}}',
        opensOnDay: 'opens {{day}} at {{time}}',
      },
      moment: {
        promoUntil: '{{label}} until {{time}}.',
        promo: '{{label}}.',
        runningLow_one: '{{name}} is running low.',
        runningLow_other: '{{count}} dishes are running low.',
        soldOut_one: '{{name}} is sold out.',
        soldOut_other: '{{count}} dishes are sold out.',
        allAvailable: 'The whole menu is available.',
      },
    },
  },
} as const;

let instance: I18nInstance | undefined;

function getInstance(): I18nInstance {
  if (!instance) {
    const created = i18next.createInstance();
    // Initialisation synchrone : aucune ressource à charger, tout est en mémoire.
    created.init({
      lng: 'fr',
      fallbackLng: 'fr',
      supportedLngs: ['fr', 'en'],
      resources: resources as never,
      initImmediate: false,
      interpolation: { escapeValue: false },
    });
    instance = created;
  }
  return instance;
}

/** Traducteur figé sur une langue. Le repli sur le français est celui de toute la plateforme. */
export function translator(locale = 'fr'): Translator {
  const i18n = getInstance();
  const fixed = i18n.getFixedT(locale.startsWith('en') ? 'en' : 'fr');
  return (key, params) => fixed(key, params ?? {}) as string;
}
