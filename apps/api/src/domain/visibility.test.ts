import { describe, expect, it } from 'vitest';
import {
  activePromos,
  isCategoryVisible,
  isItemVisible,
  ruleMatches,
  rulesFor,
  type CategoryRow,
  type ItemRow,
  type RuleRow,
} from './visibility.js';

const TZ = 'Africa/Douala'; // UTC+1 toute l'année

/** Fabrique un instant à partir d'une heure locale de Douala. */
const local = (iso: string): Date => new Date(`${iso}+01:00`);

const DIMANCHE_11H = local('2026-09-06T11:00:00');
const DIMANCHE_15H = local('2026-09-06T15:00:00');
const JEUDI_18H = local('2026-09-03T18:00:00');
const JEUDI_23H = local('2026-09-03T23:00:00');
const VENDREDI_1H = local('2026-09-04T01:00:00');
const VENDREDI_3H = local('2026-09-04T03:00:00');

const category = (over: Partial<CategoryRow> = {}): CategoryRow => ({
  id: 'cat-1',
  isVisible: true,
  archivedAt: null,
  ...over,
});

const item = (over: Partial<ItemRow> = {}): ItemRow => ({
  id: 'item-1',
  categoryId: 'cat-1',
  status: 'AVAILABLE',
  archivedAt: null,
  ...over,
});

const rule = (over: Partial<RuleRow> = {}): RuleRow => ({
  id: 'rule-1',
  targetType: 'CATEGORY',
  targetId: 'cat-1',
  kind: 'VISIBILITY',
  daysOfWeek: [0],
  startTime: '10:00',
  endTime: '14:00',
  ...over,
});

const context = (at: Date, rules: RuleRow[] = [], timezone = TZ) => ({ at, timezone, rules });

describe('isItemVisible', () => {
  it('1 — un plat ordinaire dans une catégorie ordinaire est visible', () => {
    expect(isItemVisible(item(), category(), context(JEUDI_18H))).toBe(true);
  });

  it('2 — un plat archivé ne l’est plus jamais', () => {
    expect(
      isItemVisible(item({ archivedAt: new Date('2026-01-01') }), category(), context(JEUDI_18H)),
    ).toBe(false);
  });

  it('3 — un plat DISABLED est retiré de la carte', () => {
    expect(isItemVisible(item({ status: 'DISABLED' }), category(), context(JEUDI_18H))).toBe(false);
  });

  it('4 — un plat SOLD_OUT reste visible : le client doit savoir qu’il existe', () => {
    expect(isItemVisible(item({ status: 'SOLD_OUT' }), category(), context(JEUDI_18H))).toBe(true);
  });

  it('5 — une catégorie masquée emporte ses plats', () => {
    expect(isItemVisible(item(), category({ isVisible: false }), context(JEUDI_18H))).toBe(false);
  });

  it('6 — une catégorie archivée emporte ses plats', () => {
    expect(
      isItemVisible(item(), category({ archivedAt: new Date('2026-01-01') }), context(JEUDI_18H)),
    ).toBe(false);
  });

  it('7 — un plat dont la catégorie est introuvable est masqué, pas affiché par défaut', () => {
    expect(isItemVisible(item(), undefined, context(JEUDI_18H))).toBe(false);
  });

  it('8 — règle de catégorie hors créneau : le plat disparaît', () => {
    // Brunch du dimanche 10h–14h, on est jeudi soir.
    expect(isItemVisible(item(), category(), context(JEUDI_18H, [rule()]))).toBe(false);
  });

  it('9 — règle de catégorie dans le créneau : le plat apparaît', () => {
    expect(isItemVisible(item(), category(), context(DIMANCHE_11H, [rule()]))).toBe(true);
  });

  it('10 — règle de catégorie le bon jour mais à la mauvaise heure', () => {
    expect(isItemVisible(item(), category(), context(DIMANCHE_15H, [rule()]))).toBe(false);
  });

  it('11 — une règle propre au plat prévaut sur celle de sa catégorie', () => {
    const rules = [
      rule({ id: 'cat-rule', daysOfWeek: [0], startTime: '10:00', endTime: '14:00' }),
      rule({
        id: 'item-rule',
        targetType: 'ITEM',
        targetId: 'item-1',
        daysOfWeek: [4],
        startTime: '17:00',
        endTime: '23:00',
      }),
    ];
    // Jeudi 18h : la règle de catégorie ne correspond pas, celle du plat oui — le plat gagne.
    expect(isItemVisible(item(), category(), context(JEUDI_18H, rules))).toBe(true);
  });

  it('12 — la prévalence joue aussi dans l’autre sens', () => {
    const rules = [
      rule({ id: 'cat-rule', daysOfWeek: [0], startTime: '10:00', endTime: '14:00' }),
      rule({
        id: 'item-rule',
        targetType: 'ITEM',
        targetId: 'item-1',
        daysOfWeek: [0],
        startTime: '12:00',
        endTime: '13:00',
      }),
    ];
    // Dimanche 11h : la catégorie est ouverte, mais le plat n'est servi qu'à midi.
    expect(isItemVisible(item(), category(), context(DIMANCHE_11H, rules))).toBe(false);
  });

  it('13 — plusieurs règles sur le même plat : une seule suffit', () => {
    const rules = [
      rule({ id: 'a', targetType: 'ITEM', targetId: 'item-1', daysOfWeek: [1], startTime: '08:00', endTime: '10:00' }),
      rule({ id: 'b', targetType: 'ITEM', targetId: 'item-1', daysOfWeek: [4], startTime: '17:00', endTime: '22:00' }),
    ];
    expect(isItemVisible(item(), category(), context(JEUDI_18H, rules))).toBe(true);
  });

  it('14 — créneau qui passe minuit : encore visible à 23:00 le jour même', () => {
    const nuit = rule({ daysOfWeek: [4], startTime: '22:00', endTime: '02:00' });
    expect(isItemVisible(item(), category(), context(JEUDI_23H, [nuit]))).toBe(true);
  });

  it('15 — créneau qui passe minuit : encore visible à 01:00 le lendemain', () => {
    const nuit = rule({ daysOfWeek: [4], startTime: '22:00', endTime: '02:00' });
    expect(isItemVisible(item(), category(), context(VENDREDI_1H, [nuit]))).toBe(true);
  });

  it('16 — créneau qui passe minuit : plus visible à 03:00', () => {
    const nuit = rule({ daysOfWeek: [4], startTime: '22:00', endTime: '02:00' });
    expect(isItemVisible(item(), category(), context(VENDREDI_3H, [nuit]))).toBe(false);
  });

  it('17 — une règle PROMO ne masque jamais rien', () => {
    const promo = rule({ kind: 'PROMO', daysOfWeek: [1], startTime: '17:00', endTime: '19:00' });
    expect(isItemVisible(item(), category(), context(JEUDI_18H, [promo]))).toBe(true);
  });

  it('18 — la borne de début est incluse, celle de fin exclue', () => {
    const creneau = rule({ daysOfWeek: [0], startTime: '11:00', endTime: '14:00' });
    expect(isItemVisible(item(), category(), context(local('2026-09-06T11:00:00'), [creneau]))).toBe(true);
    expect(isItemVisible(item(), category(), context(local('2026-09-06T13:59:00'), [creneau]))).toBe(true);
    expect(isItemVisible(item(), category(), context(local('2026-09-06T14:00:00'), [creneau]))).toBe(false);
  });

  it('19 — le fuseau du restaurant décide, pas celui du serveur', () => {
    const brunch = rule({ daysOfWeek: [0], startTime: '10:00', endTime: '14:00' });
    const instant = new Date('2026-09-06T10:00:00Z'); // 11:00 à Douala, 12:00 à Paris

    expect(isItemVisible(item(), category(), context(instant, [brunch], 'Africa/Douala'))).toBe(true);
    expect(isItemVisible(item(), category(), context(instant, [brunch], 'Pacific/Auckland'))).toBe(
      false,
    );
  });

  it('20 — une règle sans jour, ou aux heures identiques, ne s’applique pas', () => {
    expect(isItemVisible(item(), category(), context(DIMANCHE_11H, [rule({ daysOfWeek: [] })]))).toBe(
      false,
    );
    expect(
      isItemVisible(
        item(),
        category(),
        context(DIMANCHE_11H, [rule({ startTime: '11:00', endTime: '11:00' })]),
      ),
    ).toBe(false);
  });

  it('21 — un plat SOLD_OUT hors créneau reste masqué : la règle horaire prime', () => {
    expect(
      isItemVisible(item({ status: 'SOLD_OUT' }), category(), context(JEUDI_18H, [rule()])),
    ).toBe(false);
  });

  it('22 — une règle visant un autre plat n’a aucun effet', () => {
    const autre = rule({ targetType: 'ITEM', targetId: 'item-99', daysOfWeek: [0] });
    expect(isItemVisible(item(), category(), context(JEUDI_18H, [autre]))).toBe(true);
  });
});

describe('isCategoryVisible', () => {
  it('suit ses propres règles horaires', () => {
    expect(isCategoryVisible(category(), context(DIMANCHE_11H, [rule()]))).toBe(true);
    expect(isCategoryVisible(category(), context(JEUDI_18H, [rule()]))).toBe(false);
    expect(isCategoryVisible(category({ isVisible: false }), context(DIMANCHE_11H))).toBe(false);
    expect(
      isCategoryVisible(category({ archivedAt: new Date() }), context(DIMANCHE_11H)),
    ).toBe(false);
  });
});

describe('ruleMatches', () => {
  it('ignore une heure mal formée plutôt que de lever', () => {
    expect(ruleMatches(rule({ startTime: '25:00' }), DIMANCHE_11H, TZ)).toBe(false);
    expect(ruleMatches(rule({ endTime: 'midi' }), DIMANCHE_11H, TZ)).toBe(false);
  });
});

describe('rulesFor', () => {
  it('ne mélange pas les genres de règles', () => {
    const rules = [
      rule({ id: 'v', kind: 'VISIBILITY' }),
      rule({ id: 'p', kind: 'PROMO' }),
    ];
    expect(rulesFor(item(), rules, 'VISIBILITY').map((r) => r.id)).toEqual(['v']);
    expect(rulesFor(item(), rules, 'PROMO').map((r) => r.id)).toEqual(['p']);
  });
});

describe('activePromos', () => {
  it('ne retient que les promotions en cours', () => {
    const happyHour = rule({
      id: 'hh',
      kind: 'PROMO',
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      startTime: '17:00',
      endTime: '19:00',
      discountPercent: 30,
    });
    expect(activePromos(item(), context(JEUDI_18H, [happyHour])).map((r) => r.id)).toEqual(['hh']);
    expect(activePromos(item(), context(JEUDI_23H, [happyHour]))).toHaveLength(0);
  });
});
