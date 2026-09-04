import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayName,
  formatHHMM,
  minutesInZone,
  parseHHMM,
  weekdayInZone,
  zonedParts,
  zonedTimeToUtc,
} from './time.js';

describe('parseHHMM / formatHHMM', () => {
  it('lit les heures valides', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('08:30')).toBe(510);
    expect(parseHHMM('23:59')).toBe(1439);
  });

  it('rejette ce qui n’est pas une heure', () => {
    for (const bad of ['24:00', '8:30', '08:60', '', 'midi', null, undefined]) {
      expect(parseHHMM(bad as string)).toBeNull();
    }
  });

  it('formate en repassant dans la journée', () => {
    expect(formatHHMM(510)).toBe('08:30');
    expect(formatHHMM(0)).toBe('00:00');
    expect(formatHHMM(1440)).toBe('00:00');
    expect(formatHHMM(1470)).toBe('00:30');
    expect(formatHHMM(-30)).toBe('23:30');
  });
});

describe('zonedParts', () => {
  it('décompose un instant dans le fuseau du restaurant', () => {
    // Douala est à UTC+1 toute l'année.
    const parts = zonedParts(new Date('2026-09-04T21:30:00Z'), 'Africa/Douala');
    expect(parts).toMatchObject({ year: 2026, month: 9, day: 4, hour: 22, minute: 30 });
    expect(parts.minutesOfDay).toBe(22 * 60 + 30);
    expect(parts.weekday).toBe(5); // vendredi
  });

  it('bascule de jour au passage de minuit local', () => {
    // 23:30 UTC = 00:30 le lendemain à Douala.
    const parts = zonedParts(new Date('2026-09-04T23:30:00Z'), 'Africa/Douala');
    expect(parts.day).toBe(5);
    expect(parts.hour).toBe(0);
    expect(parts.weekday).toBe(6); // samedi
  });

  it('rend minuit comme 0 h et non 24 h', () => {
    expect(zonedParts(new Date('2026-09-04T23:00:00Z'), 'Africa/Douala').hour).toBe(0);
  });

  it('suit le changement d’heure là où il existe', () => {
    // Paris : +2 en été, +1 en hiver. Le fuseau du restaurant n'est pas toujours fixe.
    expect(zonedParts(new Date('2026-07-15T12:00:00Z'), 'Europe/Paris').hour).toBe(14);
    expect(zonedParts(new Date('2026-01-15T12:00:00Z'), 'Europe/Paris').hour).toBe(13);
  });
});

describe('minutesInZone / weekdayInZone', () => {
  it('renvoie les minutes locales et le jour local', () => {
    const at = new Date('2026-09-06T10:15:00Z'); // dimanche 11:15 à Douala
    expect(minutesInZone(at, 'Africa/Douala')).toBe(11 * 60 + 15);
    expect(weekdayInZone(at, 'Africa/Douala')).toBe(0);
  });
});

describe('zonedTimeToUtc', () => {
  it('reconstruit l’instant UTC d’une heure locale', () => {
    const utc = zonedTimeToUtc('Africa/Douala', 2026, 9, 5, 11 * 60);
    expect(utc.toISOString()).toBe('2026-09-05T10:00:00.000Z');
  });

  it('reste juste sur un fuseau à heure d’été', () => {
    const ete = zonedTimeToUtc('Europe/Paris', 2026, 7, 15, 14 * 60);
    expect(ete.toISOString()).toBe('2026-07-15T12:00:00.000Z');
    const hiver = zonedTimeToUtc('Europe/Paris', 2026, 1, 15, 13 * 60);
    expect(hiver.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });
});

describe('addDays', () => {
  it('franchit les fins de mois et les années', () => {
    expect(addDays(2026, 9, 30, 1)).toEqual({ year: 2026, month: 10, day: 1 });
    expect(addDays(2026, 12, 31, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays(2028, 2, 28, 1)).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe('dayName', () => {
  it('nomme les jours dans les deux langues', () => {
    expect(dayName(0)).toBe('Dimanche');
    expect(dayName(6)).toBe('Samedi');
    expect(dayName(1, 'en')).toBe('Monday');
  });
});
