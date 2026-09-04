import { describe, expect, it } from 'vitest';
import { ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH } from '@evolyx/shared';
import {
  CODE_SPACE,
  generateAccessCode,
  generateAccessCodes,
  isValidAccessCode,
  normaliseAccessCode,
} from './access-code.js';

describe('generateAccessCode', () => {
  it('produit six caractères de l’alphabet convenu', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateAccessCode();
      expect(code).toHaveLength(ACCESS_CODE_LENGTH);
      expect([...code].every((c) => ACCESS_CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('n’émet jamais de caractère ambigu', () => {
    const codes = Array.from({ length: 500 }, () => generateAccessCode()).join('');
    for (const ambigu of ['I', 'L', 'O', '0', '1']) {
      expect(codes).not.toContain(ambigu);
    }
  });

  it('ne se répète pas en pratique', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateAccessCode()));
    // 2 000 tirages dans un espace de ~10⁹ : une collision serait le signe d'un générateur cassé.
    expect(codes.size).toBe(2000);
  });

  it('laisse une marge confortable avant collision', () => {
    expect(CODE_SPACE).toBeGreaterThan(800_000_000);
  });
});

describe('generateAccessCodes', () => {
  it('rend exactement le nombre demandé, tous distincts', () => {
    const codes = generateAccessCodes(45);
    expect(codes).toHaveLength(45);
    expect(new Set(codes).size).toBe(45);
  });
});

describe('isValidAccessCode', () => {
  it('accepte un code bien formé', () => {
    expect(isValidAccessCode('AB2C3D')).toBe(true);
  });

  it('refuse les longueurs, casses et caractères hors alphabet', () => {
    for (const bad of ['AB2C3', 'AB2C3DE', 'ab2c3d', 'AB2C3O', 'AB2C-D', '']) {
      expect(isValidAccessCode(bad), bad).toBe(false);
    }
  });
});

describe('normaliseAccessCode', () => {
  it('redresse une saisie manuelle approximative', () => {
    expect(normaliseAccessCode(' ab2c3d ')).toBe('AB2C3D');
    expect(normaliseAccessCode('AB-2C3D')).toBe('AB2C3D');
    // O et 0 n'existent pas dans l'alphabet : le caractère lu était un Q.
    expect(normaliseAccessCode('QO2C3D')).toBe('QQ2C3D');
    expect(normaliseAccessCode('IL2C3D')).toBe('JJ2C3D');
  });

  it('laisse intact un code déjà valide', () => {
    const code = generateAccessCode();
    expect(normaliseAccessCode(code)).toBe(code);
  });
});
