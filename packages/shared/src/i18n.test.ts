import { describe, expect, it } from 'vitest';
import { flattenI18n, hasTranslation, makeI18n, resolveI18n } from './i18n.js';

describe('resolveI18n', () => {
  const plat = { fr: 'Poulet braisé', en: 'Grilled chicken' };

  it('rend la langue demandée', () => {
    expect(resolveI18n(plat, 'fr')).toBe('Poulet braisé');
    expect(resolveI18n(plat, 'en')).toBe('Grilled chicken');
  });

  it('retombe sur le français quand la traduction manque', () => {
    expect(resolveI18n({ fr: 'Ndolè' }, 'en')).toBe('Ndolè');
  });

  it('traite une traduction vide ou blanche comme absente', () => {
    expect(resolveI18n({ fr: 'Ndolè', en: '' }, 'en')).toBe('Ndolè');
    expect(resolveI18n({ fr: 'Ndolè', en: '   ' }, 'en')).toBe('Ndolè');
  });

  it('replie champ par champ, pas fiche par fiche', () => {
    // C'est exactement le cas de Casa Lina : nom traduit, description non traduite.
    const nom = { fr: 'Pizza Reine', en: 'Queen Pizza' };
    const description = { fr: 'Jambon, champignons, olives' };
    expect(resolveI18n(nom, 'en')).toBe('Queen Pizza');
    expect(resolveI18n(description, 'en')).toBe('Jambon, champignons, olives');
  });

  it('accepte un repli explicite autre que le français', () => {
    expect(resolveI18n({ en: 'Only English' }, 'fr', 'en')).toBe('Only English');
  });

  it('prend la première valeur non vide en dernier recours', () => {
    expect(resolveI18n({ es: 'Pollo' } as Record<string, string>, 'en')).toBe('Pollo');
  });

  it('ne casse jamais sur une entrée absente ou mal formée', () => {
    expect(resolveI18n(null)).toBe('');
    expect(resolveI18n(undefined)).toBe('');
    expect(resolveI18n({})).toBe('');
    expect(resolveI18n('chaîne nue')).toBe('chaîne nue');
    expect(resolveI18n(42 as unknown as string)).toBe('');
  });
});

describe('hasTranslation', () => {
  it('distingue une vraie traduction d’un repli', () => {
    expect(hasTranslation({ fr: 'Ndolè', en: 'Ndole stew' }, 'en')).toBe(true);
    expect(hasTranslation({ fr: 'Ndolè' }, 'en')).toBe(false);
    expect(hasTranslation({ fr: 'Ndolè', en: '  ' }, 'en')).toBe(false);
    expect(hasTranslation(null, 'fr')).toBe(false);
  });
});

describe('makeI18n', () => {
  it('écarte les traductions vides et coupe les blancs', () => {
    expect(makeI18n({ fr: '  Ndolè ', en: '', de: null })).toEqual({ fr: 'Ndolè' });
  });
});

describe('flattenI18n', () => {
  it('aplatit les champs demandés et laisse les autres intacts', () => {
    const row = { id: 'x1', name: { fr: 'Ndolè', en: 'Ndole' }, price: 3500 };
    expect(flattenI18n(row, ['name'], 'en')).toEqual({ id: 'x1', name: 'Ndole', price: 3500 });
  });
});
