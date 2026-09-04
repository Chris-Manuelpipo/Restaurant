import { describe, expect, it } from 'vitest';
import { MODULES, ROLES, type Role } from '@evolyx/shared';
import {
  ALL_CAPABILITIES,
  CAPABILITIES,
  can,
  capabilitiesFor,
  moduleAllows,
  type Capability,
} from './permissions.js';

/** Le tableau du cahier des charges, recopié tel quel — c'est lui qui fait foi. */
const ATTENDU: Record<Capability, Role[]> = {
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
  [CAPABILITIES.AUDIT_READ]: ['PLATFORM_ADMIN', 'ADMIN'],
};

describe('matrice de permissions', () => {
  it('couvre toutes les capacités déclarées', () => {
    expect(Object.keys(ATTENDU).sort()).toEqual([...ALL_CAPABILITIES].sort());
  });

  it.each(ALL_CAPABILITIES)('« %s » est accordée aux bons rôles, et à eux seuls', (capability) => {
    for (const role of ROLES) {
      expect(can(role, capability), `${role} / ${capability}`).toBe(
        ATTENDU[capability].includes(role),
      );
    }
  });

  it('un STAFF lit la carte mais ne la modifie pas — sauf le statut d’un plat', () => {
    expect(can('STAFF', CAPABILITIES.MENU_READ)).toBe(true);
    expect(can('STAFF', CAPABILITIES.MENU_WRITE)).toBe(false);
    expect(can('STAFF', CAPABILITIES.MENU_STATUS)).toBe(true);
  });

  it('un MANAGER touche à la carte mais pas à la charte ni aux comptes', () => {
    expect(can('MANAGER', CAPABILITIES.MENU_WRITE)).toBe(true);
    expect(can('MANAGER', CAPABILITIES.RESTAURANT_WRITE)).toBe(false);
    expect(can('MANAGER', CAPABILITIES.USERS_WRITE)).toBe(false);
  });

  it('seul le PLATFORM_ADMIN administre la plateforme', () => {
    expect(can('PLATFORM_ADMIN', CAPABILITIES.PLATFORM_MANAGE)).toBe(true);
    for (const role of ['ADMIN', 'MANAGER', 'STAFF'] as Role[]) {
      expect(can(role, CAPABILITIES.PLATFORM_MANAGE)).toBe(false);
    }
  });
});

describe('modules', () => {
  it('les codes QR exigent le module menu_qr', () => {
    expect(moduleAllows(CAPABILITIES.ACCESS_POINTS_READ, [MODULES.CORE])).toBe(false);
    expect(moduleAllows(CAPABILITIES.ACCESS_POINTS_READ, [MODULES.CORE, MODULES.MENU_QR])).toBe(true);
  });

  it('les capacités du socle ne dépendent d’aucun module', () => {
    expect(moduleAllows(CAPABILITIES.MENU_WRITE, [])).toBe(true);
  });
});

describe('capabilitiesFor', () => {
  it('retire les capacités des modules inactifs', () => {
    const avec = capabilitiesFor('ADMIN', [MODULES.CORE, MODULES.MENU_QR]);
    const sans = capabilitiesFor('ADMIN', [MODULES.CORE]);
    expect(avec).toContain(CAPABILITIES.ACCESS_POINTS_WRITE);
    expect(sans).not.toContain(CAPABILITIES.ACCESS_POINTS_WRITE);
    expect(sans).toContain(CAPABILITIES.MENU_WRITE);
  });

  it('un STAFF sans module n’a que ses droits de lecture et le statut des plats', () => {
    expect(capabilitiesFor('STAFF', []).sort()).toEqual(
      [
        CAPABILITIES.RESTAURANT_READ,
        CAPABILITIES.MENU_READ,
        CAPABILITIES.MENU_STATUS,
        CAPABILITIES.RULES_READ,
      ].sort(),
    );
  });
});
