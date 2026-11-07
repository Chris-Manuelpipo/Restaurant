import { MODULES, type ModuleKey, type Role } from '@evolyx/shared';

/**
 * Matrice de permissions déclarative.
 *
 * Une capacité = un droit métier, pas une route. Les handlers ne testent jamais un rôle :
 * ils exigent une capacité. Ajouter un rôle ou déplacer un droit se fait ici, en une ligne,
 * et le test de la matrice le vérifie pour les quatre rôles d'un coup.
 */

export const CAPABILITIES = {
  /* Plateforme */
  PLATFORM_MANAGE: 'platform:manage',

  /* Identité et charte */
  RESTAURANT_READ: 'restaurant:read',
  RESTAURANT_WRITE: 'restaurant:write',

  /* Comptes */
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',

  /* Carte */
  MENU_READ: 'menu:read',
  MENU_WRITE: 'menu:write',
  /** Le geste du quotidien : marquer un plat épuisé. Ouvert à toute la salle. */
  MENU_STATUS: 'menu:status',

  /* Règles de disponibilité */
  RULES_READ: 'rules:read',
  RULES_WRITE: 'rules:write',

  /* Codes QR */
  ACCESS_POINTS_READ: 'access_points:read',
  ACCESS_POINTS_WRITE: 'access_points:write',

  /* Tables de la salle */
  TABLES_READ: 'tables:read',
  TABLES_WRITE: 'tables:write',
  /** Libre, occupée, réservée : le geste du service. Ouvert à toute la salle. */
  TABLES_STATUS: 'tables:status',

  /* Journal */
  AUDIT_READ: 'audit:read',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/**
 * Qui peut quoi. Lecture directe du tableau du cahier des charges :
 *
 * |                          | PLATFORM_ADMIN | ADMIN | MANAGER | STAFF   |
 * |--------------------------|:--------------:|:-----:|:-------:|:-------:|
 * | Restaurants plateforme   |       ✔        |   —   |    —    |    —    |
 * | Charte et identité       |       ✔        |   ✔   |    —    |    —    |
 * | Utilisateurs             |       ✔        |   ✔   |    —    |    —    |
 * | Menu, catégories, règles |       ✔        |   ✔   |    ✔    | lecture |
 * | Statut d'un plat         |       ✔        |   ✔   |    ✔    |    ✔    |
 * | Codes QR                 |       ✔        |   ✔   |    ✔    | lecture |
 * | Tables (plan de salle)   |       ✔        |   ✔   |    ✔    | lecture |
 * | Statut d'une table       |       ✔        |   ✔   |    ✔    |    ✔    |
 */
const MATRIX: Record<Capability, Role[]> = {
  [CAPABILITIES.PLATFORM_MANAGE]: ['PLATFORM_ADMIN'],

  [CAPABILITIES.RESTAURANT_READ]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  [CAPABILITIES.RESTAURANT_WRITE]: ['PLATFORM_ADMIN', 'ADMIN'],

  [CAPABILITIES.USERS_READ]: ['PLATFORM_ADMIN', 'ADMIN'],
  [CAPABILITIES.USERS_WRITE]: ['PLATFORM_ADMIN', 'ADMIN'],

  [CAPABILITIES.MENU_READ]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  [CAPABILITIES.MENU_WRITE]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER'],
  [CAPABILITIES.MENU_STATUS]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],

  [CAPABILITIES.RULES_READ]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  [CAPABILITIES.RULES_WRITE]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER'],

  [CAPABILITIES.ACCESS_POINTS_READ]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  [CAPABILITIES.ACCESS_POINTS_WRITE]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER'],

  [CAPABILITIES.TABLES_READ]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  [CAPABILITIES.TABLES_WRITE]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER'],
  [CAPABILITIES.TABLES_STATUS]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],

  [CAPABILITIES.AUDIT_READ]: ['PLATFORM_ADMIN', 'ADMIN'],
};

/**
 * Modules requis par capacité. Un restaurant sans le module `menu_qr` n'a pas de codes QR :
 * l'endpoint n'est pas seulement masqué dans la navigation, il refuse.
 */
const MODULE_REQUIREMENTS: Partial<Record<Capability, ModuleKey>> = {
  [CAPABILITIES.ACCESS_POINTS_READ]: MODULES.MENU_QR,
  [CAPABILITIES.ACCESS_POINTS_WRITE]: MODULES.MENU_QR,
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[capability]?.includes(role) ?? false;
}

export function moduleFor(capability: Capability): ModuleKey | undefined {
  return MODULE_REQUIREMENTS[capability];
}

/** Vrai si le restaurant a le module nécessaire — les capacités sans module passent toujours. */
export function moduleAllows(capability: Capability, enabledModules: string[]): boolean {
  const required = MODULE_REQUIREMENTS[capability];
  return required === undefined || enabledModules.includes(required);
}

/** Toutes les capacités d'un rôle, filtrées par les modules actifs. Envoyé au front par /auth/me. */
export function capabilitiesFor(role: Role, enabledModules: string[] = []): Capability[] {
  return (Object.keys(MATRIX) as Capability[]).filter(
    (capability) => can(role, capability) && moduleAllows(capability, enabledModules),
  );
}

export const ALL_CAPABILITIES = Object.values(CAPABILITIES);
