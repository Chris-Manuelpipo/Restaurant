/**
 * Manipulation d'heures locales de restaurant.
 *
 * Deux principes tenus partout dans le code :
 *  - les instants sont des `Date` UTC ;
 *  - les horaires d'ouverture sont des chaînes `"HH:MM"` **sans fuseau**, interprétées dans
 *    le fuseau du restaurant. Un restaurant qui ouvre à 11:00 ouvre à 11:00 chez lui, même
 *    si le serveur tourne à Francfort et que le pays change d'heure d'été.
 */

export const MINUTES_PER_DAY = 24 * 60;

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `"08:30"` → 510. Renvoie null si la chaîne n'est pas une heure valide. */
export function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = HHMM_RE.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 510 → `"08:30"`. Les minutes au-delà de 24 h sont ramenées dans la journée. */
export function formatHHMM(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function isValidHHMM(value: string): boolean {
  return HHMM_RE.test(value.trim());
}

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  hour: number;
  minute: number;
  /** 0 = dimanche, conforme au champ `dayOfWeek` d'OpeningHours. */
  weekday: number;
  /** Minutes écoulées depuis minuit local. */
  minutesOfDay: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Décompose un instant dans le fuseau donné. Passe par `Intl` plutôt que par une table de
 * décalages : les changements d'heure et les fuseaux à demi-heure sont gérés par la plateforme,
 * pas par nous.
 */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };

  const year = read('year');
  const month = read('month');
  const day = read('day');
  // `hour: '2-digit'` en hour12:false peut rendre "24" à minuit sur certaines plateformes.
  const hour = read('hour') % 24;
  const minute = read('minute');

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    minutesOfDay: hour * 60 + minute,
  };
}

/** Jour de semaine local, 0 = dimanche. */
export function weekdayInZone(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).weekday;
}

/** Minutes depuis minuit, dans le fuseau donné. */
export function minutesInZone(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).minutesOfDay;
}

/**
 * Reconstruit l'instant UTC correspondant à une heure locale dans un fuseau donné.
 * Utilisé pour répondre « ouvre demain à 11:00 » avec une vraie date, pas juste un texte.
 * Deux passes suffisent à converger même quand l'heure d'été décale le résultat.
 */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  minutesOfDay: number,
): Date {
  const target = Date.UTC(year, month - 1, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  let guess = new Date(target);
  for (let i = 0; i < 2; i += 1) {
    const parts = zonedParts(guess, timeZone);
    const actual = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const drift = target - actual;
    if (drift === 0) break;
    guess = new Date(guess.getTime() + drift);
  }
  return guess;
}

/** Ajoute des jours à une date calendaire locale, en gérant les fins de mois. */
export function addDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export const DAY_NAMES_FR = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

export const DAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function dayName(dayOfWeek: number, locale = 'fr'): string {
  const index = ((dayOfWeek % 7) + 7) % 7;
  return (locale.startsWith('en') ? DAY_NAMES_EN : DAY_NAMES_FR)[index] as string;
}
