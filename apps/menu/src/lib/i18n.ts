import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Traduction de l'interface du menu.
 *
 * Le **contenu** (noms de plats, descriptions, bandeau, horaires) arrive déjà traduit du
 * serveur : le téléphone ne trie aucun objet de traduction. Il ne reste ici que les rares
 * mots de l'habillage — d'où un dictionnaire minuscule, embarqué, sans chargement réseau.
 */
const resources = {
  fr: {
    translation: {
      soldOut: 'Épuisé',
      from: 'à partir de',
      closed: 'Fermé',
      open: 'Ouvert',
      offlineSaved: 'Hors ligne — menu enregistré le {{date}}',
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
      minutes: '≈ {{count}} min',
      closeSheet: 'Fermer',
      table: 'Table',
    },
  },
  en: {
    translation: {
      soldOut: 'Sold out',
      from: 'from',
      closed: 'Closed',
      open: 'Open',
      offlineSaved: 'Offline — menu saved on {{date}}',
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
      minutes: '≈ {{count}} min',
      closeSheet: 'Close',
      table: 'Table',
    },
  },
};

void i18next.use(initReactI18next).init({
  resources,
  lng: 'fr',
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'en'],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18next;

export const DAY_NAMES: Record<string, string[]> = {
  fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
