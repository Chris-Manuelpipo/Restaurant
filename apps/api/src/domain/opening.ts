import { addDays, dayName, formatHHMM, parseHHMM, zonedParts, zonedTimeToUtc } from '@evolyx/shared';
import { translator, type Translator } from '../i18n/server.js';

/**
 * Calcul d'ouverture.
 *
 * Deux difficultés, traitées explicitement :
 *  - le fuseau du restaurant, qui n'est jamais celui du serveur ;
 *  - les services qui passent minuit — « 11:00 → 00:30 » n'est pas une erreur de saisie,
 *    c'est le vendredi soir.
 *
 * Le menu reste consultable restaurant fermé : cette fonction sert à afficher un état,
 * jamais à bloquer l'accès.
 */

export interface OpeningHourRow {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface OpeningState {
  isOpen: boolean;
  /** Instant de la prochaine bascule ouvert↔fermé. Null si le restaurant n'ouvre jamais. */
  nextChange: Date | null;
  /** Phrase prête à afficher : « ferme à 23:00 », « ouvre demain à 11:00 ». */
  nextChangeLabel: string | null;
}

const DAY = 24 * 60;

interface Slot {
  /** Minutes depuis minuit du jour de référence — peut dépasser 1440 ou passer sous 0. */
  start: number;
  end: number;
}

/**
 * Développe les horaires hebdomadaires en créneaux linéaires autour du jour de référence.
 * On balaie de la veille (un service qui a commencé hier peut être encore en cours) à
 * J+7 (pour répondre « ouvre lundi » quand le restaurant ferme plusieurs jours).
 */
function expandSlots(hours: OpeningHourRow[], referenceWeekday: number): Slot[] {
  const byDay = new Map<number, OpeningHourRow>();
  for (const row of hours) byDay.set(row.dayOfWeek, row);

  const slots: Slot[] = [];
  for (let offset = -1; offset <= 7; offset += 1) {
    const weekday = (((referenceWeekday + offset) % 7) + 7) % 7;
    const row = byDay.get(weekday);
    if (!row || !row.isOpen) continue;

    const open = parseHHMM(row.openTime);
    const close = parseHHMM(row.closeTime);
    if (open === null || close === null || open === close) continue;

    // Fermeture avant l'ouverture : le service déborde sur le lendemain.
    const end = close > open ? close : close + DAY;
    slots.push({ start: offset * DAY + open, end: offset * DAY + end });
  }
  return slots.sort((a, b) => a.start - b.start);
}

/** Convertit une abscisse en minutes (relative à minuit du jour de référence) en instant UTC. */
function toDate(
  minutes: number,
  reference: { year: number; month: number; day: number },
  timezone: string,
): Date {
  const dayOffset = Math.floor(minutes / DAY);
  const withinDay = ((minutes % DAY) + DAY) % DAY;
  const shifted = addDays(reference.year, reference.month, reference.day, dayOffset);
  return zonedTimeToUtc(timezone, shifted.year, shifted.month, shifted.day, withinDay);
}

export function computeOpening(
  hours: OpeningHourRow[],
  at: Date,
  timezone: string,
  locale = 'fr',
  t: Translator = translator(locale),
): OpeningState {
  const now = zonedParts(at, timezone);
  const slots = expandSlots(hours, now.weekday);
  const minutes = now.minutesOfDay;

  const current = slots.find((slot) => slot.start <= minutes && minutes < slot.end);

  if (current) {
    return {
      isOpen: true,
      nextChange: toDate(current.end, now, timezone),
      nextChangeLabel: t('opening.closesAt', { time: formatHHMM(current.end) }),
    };
  }

  const next = slots.find((slot) => slot.start > minutes);
  if (!next) {
    return { isOpen: false, nextChange: null, nextChangeLabel: null };
  }

  return {
    isOpen: false,
    nextChange: toDate(next.start, now, timezone),
    nextChangeLabel: openingLabel(next.start, minutes, now.weekday, locale, t),
  };
}

function openingLabel(
  start: number,
  now: number,
  referenceWeekday: number,
  locale: string,
  t: Translator,
): string {
  const time = formatHHMM(start);
  const dayOffset = Math.floor(start / DAY) - Math.floor(now / DAY);

  if (dayOffset <= 0) return t('opening.opensAt', { time });
  if (dayOffset === 1) return t('opening.opensTomorrow', { time });

  const weekday = (((referenceWeekday + dayOffset) % 7) + 7) % 7;
  const name = dayName(weekday, locale);
  return t('opening.opensOnDay', {
    day: locale.startsWith('en') ? name : name.toLowerCase(),
    time,
  });
}

/** Sept lignes complètes, dans l'ordre lundi→dimanche, pour l'affichage du tableau d'horaires. */
export function orderedWeek(hours: OpeningHourRow[]): OpeningHourRow[] {
  const byDay = new Map<number, OpeningHourRow>();
  for (const row of hours) byDay.set(row.dayOfWeek, row);
  return [1, 2, 3, 4, 5, 6, 0].map(
    (day) =>
      byDay.get(day) ?? { dayOfWeek: day, isOpen: false, openTime: '00:00', closeTime: '00:00' },
  );
}
