// Utilitaires de fuseau horaire sans dépendance (API Intl).
// Toute notion de « jour » ou d'« heure locale » doit passer par le fuseau de l'agence,
// jamais par celui du serveur (UTC en production).

export const DEFAULT_TIMEZONE = 'Africa/Casablanca';

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = dimanche
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Composantes de date/heure d'un instant, vues dans un fuseau donné. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

/** Décalage (minutes) entre l'heure locale du fuseau et UTC à cet instant. */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Instant UTC correspondant à une heure « murale » dans un fuseau (gère les changements d'heure). */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = getTimeZoneOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset1 * 60000;
  const offset2 = getTimeZoneOffsetMinutes(new Date(result), timeZone);
  if (offset2 !== offset1) result = guess - offset2 * 60000;
  return new Date(result);
}

/** Clé de jour « AAAA-MM-JJ » dans le fuseau. */
export function dayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Ajoute n jours à une clé de jour (calendrier pur, indépendant du fuseau). */
export function addDaysToKey(key: string, days: number): string {
  const p = parseDayKey(key);
  if (!p) throw new Error(`Clé de jour invalide : ${key}`);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return d.toISOString().slice(0, 10);
}

/** Jour de la semaine (0 = dimanche) d'une clé de jour. */
export function weekdayOfKey(key: string): number {
  const p = parseDayKey(key);
  if (!p) throw new Error(`Clé de jour invalide : ${key}`);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Bornes [début, fin[ d'un jour local (clé) exprimées en UTC. */
export function dayBounds(key: string, timeZone: string): { start: Date; end: Date } {
  const p = parseDayKey(key);
  if (!p) throw new Error(`Clé de jour invalide : ${key}`);
  const next = parseDayKey(addDaysToKey(key, 1))!;
  return {
    start: zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timeZone),
    end: zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone),
  };
}

/** Début du jour local contenant `date`, et début du jour suivant. */
export function getDayWindow(date: Date, timeZone: string): { key: string; start: Date; end: Date } {
  const key = dayKey(date, timeZone);
  return { key, ...dayBounds(key, timeZone) };
}

/** « HH:MM » → minutes depuis minuit, ou null si invalide. */
export function parseHm(value: string | undefined | null): number | null {
  if (!value) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
