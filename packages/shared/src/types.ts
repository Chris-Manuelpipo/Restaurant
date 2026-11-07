import type { ThemeInput } from './theme.js';
import type {
  AccessPointKind,
  ItemStatus,
  Locale,
  ModuleKey,
  RestaurantStatus,
  Role,
  TableStatus,
} from './constants.js';

/* ═══════════════════════════════════════════════════════════════════════════
   Contrat du menu public.
   Les textes arrivent **déjà résolus** dans la langue demandée : le client final
   ne reçoit jamais d'objet de traduction, c'est autant d'octets épargnés sur un
   forfait de données payé à la minute.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PublicImage {
  thumb: string;
  medium: string;
  large: string;
  /** Repli JPEG pour les navigateurs sans WebP — rare, mais existant sur Android ancien. */
  fallback: string;
  width: number;
  height: number;
}

export interface PublicVariant {
  id: string;
  name: string;
  price: number;
}

export interface PublicSupplement {
  id: string;
  name: string;
  price: number;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  /** Prix unique, ou null quand le plat a des variantes. */
  basePrice: number | null;
  /** Le plus bas des prix affichables — sert au « à partir de ». */
  fromPrice: number;
  hasVariants: boolean;
  variants: PublicVariant[];
  supplements: PublicSupplement[];
  prepMinutes: number | null;
  allergens: string[];
  isPerPerson: boolean;
  badge: string | null;
  /** `SOLD_OUT` reste dans la liste, marqué : le client doit savoir ce qui existe d'habitude. */
  status: Extract<ItemStatus, 'AVAILABLE' | 'SOLD_OUT'>;
  images: PublicImage[];
  /** Promotions actives à l'instant demandé. */
  promos: PublicPromo[];
}

export interface PublicPromo {
  label: string;
  discountPercent: number | null;
  endsAt: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  /** « emoji:🔥 », « icon:flame », ou un emoji nu. Voir parseCategoryVisual(). */
  icon: string | null;
  /** Photo de catégorie ; elle prime sur l'icône à l'affichage. */
  imageUrl: string | null;
  color: string | null;
  items: PublicMenuItem[];
}

export interface PublicOpening {
  isOpen: boolean;
  /** Prochaine bascule ouvert↔fermé, en ISO UTC. Null si le restaurant n'ouvre jamais. */
  nextChange: string | null;
  /** Phrase prête à afficher : « ferme à 23:00 », « ouvre demain à 11:00 ». */
  nextChangeLabel: string | null;
  hours: PublicOpeningHour[];
}

export interface PublicOpeningHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface PublicRestaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  coverPreset: string | null;
  theme: ThemeInput;
  currency: string;
  timezone: string;
  defaultLocale: Locale;
  enabledLocales: Locale[];
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  socials: Record<string, string>;
}

export interface PublicMenuResponse {
  restaurant: PublicRestaurant;
  opening: PublicOpening;
  /** Bandeau du moment, composé serveur. Vide si rien à signaler. */
  moment: string;
  categories: PublicCategory[];
  locale: Locale;
  /** Instant de calcul, ISO UTC. Sert au bandeau « menu enregistré le … » hors ligne. */
  generatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Contrat du back-office.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  restaurantId: string | null;
  lastLoginAt: string | null;
}

export interface SessionRestaurant {
  id: string;
  slug: string;
  name: string;
  status: RestaurantStatus;
  logoUrl: string | null;
  theme: ThemeInput;
  currency: string;
  timezone: string;
  defaultLocale: Locale;
  enabledLocales: Locale[];
  onboardingStep: number;
  onboardingCompletedAt: string | null;
}

export interface SessionResponse {
  user: SessionUser;
  restaurant: SessionRestaurant | null;
  /** Modules actifs : la navigation et les endpoints disponibles s'en déduisent. */
  modules: ModuleKey[];
  /** Capacités accordées au rôle courant — le front s'en sert pour masquer, l'API pour refuser. */
  capabilities: string[];
}

export interface AccessPointSummary {
  id: string;
  code: string;
  kind: AccessPointKind;
  label: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  /** URL complète à imprimer, telle qu'elle est encodée dans le QR. */
  url: string;
}

export interface DiningTableSummary {
  id: string;
  label: string;
  seats: number;
  zone: string | null;
  status: TableStatus;
  statusChangedAt: string;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  /** Le carton posé sur la table, s'il y en a un. */
  accessPoint: Pick<AccessPointSummary, 'id' | 'code' | 'isActive' | 'url'> | null;
}

export interface MenuImportRow {
  line: number;
  raw: string;
  ok: boolean;
  name: string | null;
  price: number | null;
  categoryName: string | null;
  /** Raison du rejet, en français, affichée telle quelle à côté de la ligne. */
  reason: string | null;
}

export interface MenuImportPreview {
  rows: MenuImportRow[];
  recognised: number;
  rejected: number;
  categories: string[];
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userName: string | null;
  createdAt: string;
  diff: unknown;
}
