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

/** Composantes vues par le moteur, sans correction (voir ZONE_RULES). */
function engineParts(date: Date, timeZone: string): ZonedParts {
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

// ─── Règles de fuseau plus récentes que la base tz du moteur ─────────────────
// Les calculs reposent sur la base tz embarquée par le moteur (Node, navigateur), qui peut dater :
// celle de Node 22.11 remonte à 2023 ou 2024. Le Maroc est repassé à UTC+0 de façon permanente le
// 20/09/2026 à 02:00 (décret n° 2.26.530, tzdata 2026c) ; un moteur plus ancien le laisse à UTC+1
// et avance toutes les heures marocaines d'une heure. Pour ces fuseaux, à partir de la bascule,
// on calcule alors avec le fuseau de remplacement. Un moteur à jour n'est jamais corrigé.
type ZoneRule = {
  zones: readonly string[];
  /** Instant d'entrée en vigueur. */
  since: number;
  /** Fuseau équivalent à la nouvelle règle, connu de tous les moteurs. */
  substitute: string;
  /** Instant où l'ancienne et la nouvelle règle donnent des décalages différents. */
  probe: number;
};

const ZONE_RULES: readonly ZoneRule[] = [
  {
    zones: ['africa/casablanca', 'africa/el_aaiun'],
    since: Date.UTC(2026, 8, 20, 1),
    substitute: 'UTC',
    // Le 20/10/2026 est hors ramadan : l'ancienne règle y donne UTC+1.
    probe: Date.UTC(2026, 9, 20, 12),
  },
];

/** Décalage (minutes) d'un fuseau à un instant, tel que le moteur le calcule. */
export type EngineOffset = (instant: number, timeZone: string) => number;

function offsetMinutes(p: ZonedParts, instant: number): number {
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

function engineOffsetMinutes(instant: number, timeZone: string): number {
  return offsetMinutes(engineParts(new Date(instant), timeZone), instant);
}

function ruleFor(timeZone: string): ZoneRule | undefined {
  const key = timeZone.toLowerCase();
  return ZONE_RULES.find((r) => r.zones.includes(key));
}

/** Fuseau avec lequel calculer `instant`. Le moteur est un paramètre pour pouvoir tester les deux cas. */
export function resolveTimeZone(timeZone: string, instant: number, engineOffset: EngineOffset): string {
  const rule = ruleFor(timeZone);
  if (!rule || !(instant >= rule.since)) return timeZone;
  const known = engineOffset(rule.probe, timeZone) === engineOffset(rule.probe, rule.substitute);
  return known ? timeZone : rule.substitute;
}

// Le moteur ne change pas en cours d'exécution : sa réponse est calculée une fois par fuseau.
const zoneAfterRule = new Map<string, string>();

/** Fuseau avec lequel calculer cet instant : celui demandé, sauf règle récente inconnue du moteur. */
export function effectiveTimeZone(timeZone: string, date: Date): string {
  const rule = ruleFor(timeZone);
  if (!rule || !(date.getTime() >= rule.since)) return timeZone;
  let zone = zoneAfterRule.get(timeZone);
  if (!zone) {
    zone = resolveTimeZone(timeZone, rule.since, engineOffsetMinutes);
    zoneAfterRule.set(timeZone, zone);
  }
  return zone;
}

/** Vrai si la base tz du moteur est antérieure à une règle ci-dessus (l'application corrige alors). */
export function hasOutdatedZoneRules(): boolean {
  return ZONE_RULES.some((r) => r.zones.some((z) => resolveTimeZone(z, r.since, engineOffsetMinutes) !== z));
}

/** Composantes de date/heure d'un instant, vues dans un fuseau donné. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  return engineParts(date, effectiveTimeZone(timeZone, date));
}

/** Décalage (minutes) entre l'heure locale du fuseau et UTC à cet instant. */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  return offsetMinutes(getZonedParts(date, timeZone), date.getTime());
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
