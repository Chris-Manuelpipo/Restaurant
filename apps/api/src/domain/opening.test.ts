import { describe, expect, it } from 'vitest';
import { computeOpening, orderedWeek, type OpeningHourRow } from './opening.js';

const TZ = 'Africa/Douala';
const local = (iso: string): Date => new Date(`${iso}+01:00`);

/** Semaine type du Braisé : 11:00 → 23:00 tous les jours. */
const semaineSimple: OpeningHourRow[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  openTime: '11:00',
  closeTime: '23:00',
}));

/** Vendredi et samedi, le service passe minuit. */
const semaineNocturne: OpeningHourRow[] = semaineSimple.map((row) =>
  row.dayOfWeek === 5 || row.dayOfWeek === 6
    ? { ...row, openTime: '11:00', closeTime: '00:30' }
    : row,
);

describe('computeOpening', () => {
  it('dit ouvert pendant le service, avec l’heure de fermeture', () => {
    const state = computeOpening(semaineSimple, local('2026-09-03T19:00:00'), TZ);
    expect(state.isOpen).toBe(true);
    expect(state.nextChangeLabel).toBe('ferme à 23:00');
    expect(state.nextChange?.toISOString()).toBe('2026-09-03T22:00:00.000Z');
  });

  it('dit fermé avant l’ouverture, avec l’heure d’ouverture du jour', () => {
    const state = computeOpening(semaineSimple, local('2026-09-03T09:00:00'), TZ);
    expect(state.isOpen).toBe(false);
    expect(state.nextChangeLabel).toBe('ouvre à 11:00');
  });

  it('renvoie à demain après la fermeture', () => {
    const state = computeOpening(semaineSimple, local('2026-09-03T23:30:00'), TZ);
    expect(state.isOpen).toBe(false);
    expect(state.nextChangeLabel).toBe('ouvre demain à 11:00');
  });

  it('nomme le jour quand la réouverture est plus lointaine', () => {
    // Fermé du lundi au vendredi : le samedi soir, la prochaine ouverture est le samedi suivant.
    const weekend: OpeningHourRow[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      isOpen: dayOfWeek === 6,
      openTime: '18:00',
      closeTime: '23:00',
    }));
    const state = computeOpening(weekend, local('2026-09-05T23:30:00'), TZ); // samedi 23:30
    expect(state.isOpen).toBe(false);
    expect(state.nextChangeLabel).toBe('ouvre samedi à 18:00');
  });

  it('reste ouvert après minuit quand le service déborde', () => {
    const state = computeOpening(semaineNocturne, local('2026-09-05T00:15:00'), TZ); // samedi 00:15
    expect(state.isOpen).toBe(true);
    expect(state.nextChangeLabel).toBe('ferme à 00:30');
    // La bascule tombe bien le 5 septembre à 00:30 locales, soit 23:30 UTC la veille.
    expect(state.nextChange?.toISOString()).toBe('2026-09-04T23:30:00.000Z');
  });

  it('ferme à la minute exacte de fermeture', () => {
    expect(computeOpening(semaineSimple, local('2026-09-03T22:59:00'), TZ).isOpen).toBe(true);
    expect(computeOpening(semaineSimple, local('2026-09-03T23:00:00'), TZ).isOpen).toBe(false);
  });

  it('ouvre à la minute exacte d’ouverture', () => {
    expect(computeOpening(semaineSimple, local('2026-09-03T10:59:00'), TZ).isOpen).toBe(false);
    expect(computeOpening(semaineSimple, local('2026-09-03T11:00:00'), TZ).isOpen).toBe(true);
  });

  it('respecte un jour de fermeture', () => {
    const avecLundiFerme = semaineSimple.map((row) =>
      row.dayOfWeek === 1 ? { ...row, isOpen: false } : row,
    );
    const state = computeOpening(avecLundiFerme, local('2026-09-07T13:00:00'), TZ); // lundi midi
    expect(state.isOpen).toBe(false);
    expect(state.nextChangeLabel).toBe('ouvre demain à 11:00');
  });

  it('travaille dans le fuseau du restaurant, pas dans celui du serveur', () => {
    const instant = new Date('2026-09-03T22:30:00Z'); // 23:30 à Douala, 10:30 le 4 à Auckland
    expect(computeOpening(semaineSimple, instant, 'Africa/Douala').isOpen).toBe(false);
    expect(computeOpening(semaineSimple, instant, 'Pacific/Auckland').isOpen).toBe(false);

    const midi = new Date('2026-09-03T11:00:00Z'); // 12:00 à Douala
    expect(computeOpening(semaineSimple, midi, 'Africa/Douala').isOpen).toBe(true);
  });

  it('suit le changement d’heure là où il existe', () => {
    const state = computeOpening(semaineSimple, new Date('2026-07-15T10:00:00Z'), 'Europe/Paris');
    expect(state.isOpen).toBe(true); // 12:00 à Paris en été
    expect(state.nextChange?.toISOString()).toBe('2026-07-15T21:00:00.000Z'); // 23:00 locales
  });

  it('renvoie un état neutre quand le restaurant n’ouvre jamais', () => {
    const jamais = semaineSimple.map((row) => ({ ...row, isOpen: false }));
    expect(computeOpening(jamais, local('2026-09-03T12:00:00'), TZ)).toEqual({
      isOpen: false,
      nextChange: null,
      nextChangeLabel: null,
    });
  });

  it('ignore une ligne d’horaires mal formée sans planter', () => {
    const cassé: OpeningHourRow[] = [
      { dayOfWeek: 4, isOpen: true, openTime: 'onze heures', closeTime: '23:00' },
    ];
    expect(computeOpening(cassé, local('2026-09-03T12:00:00'), TZ).isOpen).toBe(false);
  });

  it('traduit en anglais', () => {
    const state = computeOpening(semaineSimple, local('2026-09-03T19:00:00'), TZ, 'en');
    expect(state.nextChangeLabel).toBe('closes at 23:00');
    const ferme = computeOpening(semaineSimple, local('2026-09-03T23:30:00'), TZ, 'en');
    expect(ferme.nextChangeLabel).toBe('opens tomorrow at 11:00');
  });
});

describe('orderedWeek', () => {
  it('range la semaine de lundi à dimanche et comble les trous', () => {
    const week = orderedWeek([{ dayOfWeek: 3, isOpen: true, openTime: '11:00', closeTime: '22:00' }]);
    expect(week.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week.filter((d) => d.isOpen)).toHaveLength(1);
  });
});
