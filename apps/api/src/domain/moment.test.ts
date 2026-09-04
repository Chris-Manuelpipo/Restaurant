import { describe, expect, it } from 'vitest';
import { composeMomentBanner, promoEndLabel } from './moment.js';
import type { RuleRow } from './visibility.js';

const promo = (label: Record<string, string>, endTime = '19:00'): RuleRow => ({
  id: 'promo-1',
  targetType: 'CATEGORY',
  targetId: 'cat-boissons',
  kind: 'PROMO',
  daysOfWeek: [1, 2, 3, 4, 5, 6],
  startTime: '17:00',
  endTime,
  label,
  discountPercent: 30,
});

describe('composeMomentBanner', () => {
  it('rassure quand il n’y a rien à signaler', () => {
    expect(composeMomentBanner({ activePromos: [], soldOut: [] })).toBe(
      'Tout le menu est disponible.',
    );
  });

  it('annonce une promotion avec son heure de fin', () => {
    const banner = composeMomentBanner({
      activePromos: [{ rule: promo({ fr: 'Happy hour −30 % sur les cocktails' }), endsAt: '19:00' }],
      soldOut: [],
    });
    expect(banner).toBe('Happy hour −30 % sur les cocktails jusqu’à 19:00.');
  });

  it('nomme le plat quand un seul est épuisé', () => {
    const banner = composeMomentBanner({ activePromos: [], soldOut: [{ name: 'Poulet DG' }] });
    expect(banner).toBe('Poulet DG est épuisé.');
  });

  it('compte les plats quand plusieurs sont épuisés', () => {
    const banner = composeMomentBanner({
      activePromos: [],
      soldOut: [{ name: 'Poulet DG' }, { name: 'Ndolè' }, { name: 'Eru' }],
    });
    expect(banner).toBe('3 plats sont épuisés.');
  });

  it('respecte l’ordre du cahier des charges : promotions, puis manques', () => {
    const banner = composeMomentBanner({
      activePromos: [{ rule: promo({ fr: 'Happy hour −30 %' }), endsAt: '19:00' }],
      soldOut: [{ name: 'Poulet DG' }],
      runningLow: [{ name: 'Maquereau' }],
    });
    expect(banner).toBe(
      'Happy hour −30 % jusqu’à 19:00. Maquereau touche à sa fin. Poulet DG est épuisé.',
    );
  });

  it('ne répète pas deux fois le même libellé de promotion', () => {
    const rule = promo({ fr: 'Happy hour −30 %' });
    const banner = composeMomentBanner({
      activePromos: [
        { rule, endsAt: '19:00' },
        { rule: { ...rule, id: 'promo-2' }, endsAt: '19:00' },
      ],
      soldOut: [],
    });
    expect(banner).toBe('Happy hour −30 % jusqu’à 19:00.');
  });

  it('replie sur le français quand la promotion n’est pas traduite', () => {
    const banner = composeMomentBanner({
      activePromos: [{ rule: promo({ fr: 'Happy hour −30 %' }), endsAt: '19:00' }],
      soldOut: [{ name: 'Grilled chicken' }],
      locale: 'en',
    });
    expect(banner).toBe('Happy hour −30 % until 19:00. Grilled chicken is sold out.');
  });

  it('traduit le reste de la phrase en anglais', () => {
    expect(composeMomentBanner({ activePromos: [], soldOut: [], locale: 'en' })).toBe(
      'The whole menu is available.',
    );
    expect(
      composeMomentBanner({
        activePromos: [],
        soldOut: [{ name: 'A' }, { name: 'B' }],
        locale: 'en',
      }),
    ).toBe('2 dishes are sold out.');
  });

  it('ignore une promotion sans libellé plutôt que d’afficher un blanc', () => {
    const banner = composeMomentBanner({
      activePromos: [{ rule: promo({ fr: '   ' }), endsAt: '19:00' }],
      soldOut: [],
    });
    expect(banner).toBe('Tout le menu est disponible.');
  });
});

describe('promoEndLabel', () => {
  it('rend l’heure de fin du créneau', () => {
    expect(promoEndLabel(promo({ fr: 'x' }, '19:00'))).toBe('19:00');
    expect(promoEndLabel({ ...promo({ fr: 'x' }), endTime: 'plus tard' })).toBeNull();
  });
});
