import { describe, expect, it } from 'vitest';
import { parseLine, parseMenuText } from './menu-import.js';

describe('parseLine', () => {
  it('lit les quatre séparateurs du cahier des charges', () => {
    expect(parseLine('Poulet braisé – 4 500')).toEqual({ name: 'Poulet braisé', price: 4500 });
    expect(parseLine('Poulet DG - 6000')).toEqual({ name: 'Poulet DG', price: 6000 });
    expect(parseLine('Brochettes : 1000')).toEqual({ name: 'Brochettes', price: 1000 });
    expect(parseLine('Côtelettes 3500')).toEqual({ name: 'Côtelettes', price: 3500 });
  });

  it('tolère FCFA, les points et les espaces de milliers', () => {
    expect(parseLine('Poisson braisé — 7 000 FCFA')?.price).toBe(7000);
    expect(parseLine('Miondo 500F')?.price).toBe(500);
    expect(parseLine('Ndolè : 3.500')?.price).toBe(3500);
    expect(parseLine('Jus de gingembre = 1,000 XAF')?.price).toBe(1000);
    expect(parseLine('Eau minérale\t500')?.price).toBe(500);
  });

  it('garde les tirets internes au nom du plat', () => {
    expect(parseLine('Croque-monsieur – 2 000')).toEqual({ name: 'Croque-monsieur', price: 2000 });
  });

  it('garde les chiffres qui font partie du nom', () => {
    expect(parseLine('Menu 2 personnes – 12 000')).toEqual({
      name: 'Menu 2 personnes',
      price: 12000,
    });
  });

  it('refuse une ligne sans prix', () => {
    expect(parseLine('Crevettes sautées à l’ail et au persil frais')).toBeNull();
    expect(parseLine('Prix du jour')).toBeNull();
    expect(parseLine('—')).toBeNull();
  });

  it('refuse un prix nul ou seul', () => {
    expect(parseLine('Offert - 0')).toBeNull();
    expect(parseLine('4500')).toBeNull();
  });
});

describe('parseMenuText', () => {
  const carte = `GRILLADES
Poulet braisé entier – 4 500
Poulet DG - 6000 FCFA
Brochettes de bœuf : 1000
Côtelettes de porc  3.500 F

POISSONS
Maquereau braisé – 2 500
Bar entier grillé — 7 000 FCFA
Crevettes sautées à l'ail et au persil frais`;

  it('reconnaît les plats et rejette ce qu’il ne comprend pas', () => {
    const preview = parseMenuText(carte);
    expect(preview.recognised).toBe(6);
    expect(preview.rejected).toBe(1);
    expect(preview.rows).toHaveLength(7);
  });

  it('repère les titres de section comme catégories', () => {
    const preview = parseMenuText(carte);
    expect(preview.categories).toEqual(['Grillades', 'Poissons']);
    expect(preview.rows[0]?.categoryName).toBe('Grillades');
    expect(preview.rows[4]?.categoryName).toBe('Poissons');
  });

  it('renvoie la ligne incomprise telle quelle, avec sa raison', () => {
    const preview = parseMenuText(carte);
    const rejected = preview.rows.find((row) => !row.ok);
    expect(rejected?.raw).toContain('Crevettes sautées');
    expect(rejected?.price).toBeNull();
    expect(rejected?.reason).toBe('Aucun prix reconnu sur cette ligne.');
    // Le nom est proposé quand même : il ne reste que le prix à saisir.
    expect(rejected?.name).toContain('Crevettes');
  });

  it('numérote les lignes sur le texte d’origine', () => {
    const preview = parseMenuText(carte);
    expect(preview.rows[0]?.line).toBe(2);
    // La ligne 6 est vide et la 7 est un titre : la dernière ligne utile est la 10e.
    expect(preview.rows.at(-1)?.line).toBe(10);
  });

  it('ignore les lignes vides et les fins de ligne Windows', () => {
    const preview = parseMenuText('Ndolè – 3 000\r\n\r\n\r\nEru – 2 500\r\n');
    expect(preview.recognised).toBe(2);
    expect(preview.rows).toHaveLength(2);
  });

  it('n’invente pas de catégorie quand la carte n’en a pas', () => {
    const preview = parseMenuText('Ndolè – 3 000\nEru – 2 500');
    expect(preview.categories).toEqual([]);
    expect(preview.rows.every((r) => r.categoryName === null)).toBe(true);
  });

  it('accepte un titre en minuscules suivi de deux-points', () => {
    const preview = parseMenuText('BOISSONS :\nJus de gingembre – 1 000');
    expect(preview.categories).toEqual(['Boissons']);
  });

  it('supporte une carte vide sans planter', () => {
    expect(parseMenuText('')).toEqual({ rows: [], recognised: 0, rejected: 0, categories: [] });
  });
});
