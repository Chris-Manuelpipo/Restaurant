import { describe, expect, it } from 'vitest';
import { currencySymbol, formatAmount, formatMoney, parseAmount } from './money.js';

const NBSP = '\u00A0';

describe('formatAmount', () => {
  it('groupe les milliers avec une espace insécable', () => {
    expect(formatAmount(4500)).toBe(`4${NBSP}500`);
    expect(formatAmount(500)).toBe('500');
    expect(formatAmount(1000000)).toBe(`1${NBSP}000${NBSP}000`);
    expect(formatAmount(0)).toBe('0');
  });
});

describe('formatMoney', () => {
  it('accole le symbole de la devise', () => {
    expect(formatMoney(4500)).toBe(`4${NBSP}500${NBSP}F`);
    expect(formatMoney(4500, 'XAF', 'long')).toBe(`4${NBSP}500${NBSP}FCFA`);
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('ZZZ')).toBe('ZZZ');
  });
});

describe('parseAmount', () => {
  it('lit les prix tels qu’ils sont écrits sur une carte', () => {
    expect(parseAmount('4500')).toBe(4500);
    expect(parseAmount('4 500')).toBe(4500);
    expect(parseAmount('4.500')).toBe(4500);
    expect(parseAmount('4,500')).toBe(4500);
    expect(parseAmount('4 500 FCFA')).toBe(4500);
    expect(parseAmount('6000F')).toBe(6000);
    expect(parseAmount('3 500 frs')).toBe(3500);
    expect(parseAmount(' 1000 ')).toBe(1000);
  });

  it('ne lit pas un point comme une décimale', () => {
    // Sur une carte camerounaise, « 3.500 » vaut trois mille cinq cents.
    expect(parseAmount('3.500')).toBe(3500);
  });

  it('rejette ce qui n’est pas un prix', () => {
    for (const bad of ['', 'gratuit', 'prix du jour', 'abc123def', '--']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });
});
