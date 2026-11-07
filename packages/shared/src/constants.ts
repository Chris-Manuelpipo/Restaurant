/**
 * Constantes partagées par l'API, le back-office et le menu client.
 * Aucun de ces trois ne doit redéfinir ces valeurs de son côté.
 */

/** Modules activables sur un restaurant. Le lot 1 n'implémente que les deux premiers. */
export const MODULES = {
  CORE: 'core',
  MENU_QR: 'menu_qr',
  ORDERING: 'ordering',
  KITCHEN: 'kitchen',
  CASHIER: 'cashier',
  DELIVERY: 'delivery',
  LOYALTY: 'loyalty',
  INVOICING: 'invoicing',
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

/** Modules livrés par le lot 1 — les seuls qu'on peut activer aujourd'hui. */
export const IMPLEMENTED_MODULES: ModuleKey[] = [MODULES.CORE, MODULES.MENU_QR];

export const DEFAULT_MODULES: ModuleKey[] = [MODULES.CORE, MODULES.MENU_QR];

export const ROLES = ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const RESTAURANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'TRIAL'] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const ITEM_STATUSES = ['AVAILABLE', 'SOLD_OUT', 'DISABLED'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ACCESS_POINT_KINDS = ['TABLE', 'COUNTER', 'WINDOW', 'POSTER', 'OTHER'] as const;
export type AccessPointKind = (typeof ACCESS_POINT_KINDS)[number];

export const TABLE_STATUSES = ['FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const RULE_TARGETS = ['CATEGORY', 'ITEM'] as const;
export const RULE_KINDS = ['VISIBILITY', 'PROMO'] as const;

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const DEFAULT_TIMEZONE = 'Africa/Douala';
export const DEFAULT_CURRENCY = 'XAF';

/**
 * Alphabet des codes d'accès : ni I, ni L, ni O, ni 0, ni 1 — un code recopié à la main
 * depuis une table ne doit jamais être ambigu. 32 caractères, 6 positions ≈ 10⁹ combinaisons.
 */
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACCESS_CODE_LENGTH = 6;

/** Allergènes proposés à la saisie. La liste reste ouverte : le champ accepte du texte libre. */
export const COMMON_ALLERGENS = [
  'gluten',
  'crustaces',
  'oeuf',
  'poisson',
  'arachide',
  'soja',
  'lait',
  'fruits-a-coque',
  'celeri',
  'moutarde',
  'sesame',
  'sulfites',
  'lupin',
  'mollusques',
  'piment',
] as const;

/**
 * Les cinq polices de titre proposées. `stack` est la valeur CSS finale,
 * `asset` le paquet @fontsource à charger (null pour la police système : rien à télécharger).
 */
export const DISPLAY_FONTS = [
  {
    key: 'fraunces',
    label: 'Fraunces',
    note: 'Serif élégante',
    stack: '"Fraunces Variable", Fraunces, Georgia, serif',
    asset: '@fontsource-variable/fraunces',
  },
  {
    key: 'bricolage',
    label: 'Bricolage Grotesque',
    note: 'Sans-serif moderne',
    stack: '"Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif',
    asset: '@fontsource-variable/bricolage-grotesque',
  },
  {
    key: 'inter',
    label: 'Inter',
    note: 'Neutre',
    stack: '"Inter Variable", Inter, system-ui, sans-serif',
    asset: '@fontsource-variable/inter',
  },
  {
    key: 'lora',
    label: 'Lora',
    note: 'Classique',
    stack: '"Lora Variable", Lora, Georgia, serif',
    asset: '@fontsource-variable/lora',
  },
  {
    key: 'system',
    label: 'Système',
    note: 'La plus légère — rien à télécharger',
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    asset: null,
  },
] as const;

export type DisplayFontKey = (typeof DISPLAY_FONTS)[number]['key'];
export const DISPLAY_FONT_KEYS = DISPLAY_FONTS.map((f) => f.key) as DisplayFontKey[];

export const BODY_FONT_STACK = '"Inter Variable", Inter, system-ui, sans-serif';

/** Largeurs des dérivés d'image, en pixels. Le menu client ne reçoit jamais l'original. */
export const IMAGE_VARIANTS = { thumb: 160, medium: 480, large: 960 } as const;
export type ImageVariantKey = keyof typeof IMAGE_VARIANTS;

/** Le cache du menu public. Court, mais suffisant pour absorber un scan de salle entière. */
export const PUBLIC_MENU_MAX_AGE = 60;
export const PUBLIC_MENU_SWR = 600;

/** Seuil au-delà duquel une couleur est jugée trop claire pour des modules de QR code. */
export const QR_LUMINANCE_CEILING = 0.4;

/** Seuil WCAG AA sur du texte courant. En dessous, on avertit — on ne bloque pas. */
export const CONTRAST_AA = 4.5;

export const PLACEHOLDER_CATEGORY_NAME = { fr: 'À classer', en: 'Uncategorised' };
