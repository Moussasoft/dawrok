// Horaires d'ouverture d'une agence, stockés en JSON dans `Branch.openHours` :
// { "mon": { "open": "09:00", "close": "19:00" }, "sun": { "closed": true }, ... }
// Un jour absent = ouvert selon les horaires par défaut ; `openHours` null = pas de contrainte.
import { z } from 'zod';
import { WEEKDAYS, type Weekday, getZonedParts, parseHm, formatHm, weekdayOfKey } from './time';

export const DEFAULT_OPEN = '09:00';
export const DEFAULT_CLOSE = '19:00';

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const dayHoursSchema = z
  .object({
    open: hm.optional(),
    close: hm.optional(),
    closed: z.boolean().optional(),
  })
  .refine((d) => d.closed || !d.open || !d.close || parseHm(d.open)! < parseHm(d.close)!, {
    message: 'open_before_close',
  });

export const openHoursSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, dayHoursSchema.optional()])) as Record<
    Weekday,
    z.ZodOptional<typeof dayHoursSchema>
  >
);

export type DayHours = z.infer<typeof dayHoursSchema>;
export type OpenHours = Partial<Record<Weekday, DayHours>>;

export function parseOpenHours(raw: string | null | undefined): OpenHours | null {
  if (!raw) return null;
  try {
    const parsed = openHoursSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Plage [ouverture, fermeture[ en minutes pour un jour de semaine, ou null si fermé. */
export function getDayRange(
  hours: OpenHours | null,
  weekday: number
): { open: number; close: number } | null {
  const conf = hours?.[WEEKDAYS[weekday]];
  if (conf?.closed) return null;
  const open = parseHm(conf?.open) ?? parseHm(DEFAULT_OPEN)!;
  const close = parseHm(conf?.close) ?? parseHm(DEFAULT_CLOSE)!;
  if (close <= open) return null;
  return { open, close };
}

export function getDayRangeForKey(hours: OpenHours | null, key: string) {
  return getDayRange(hours, weekdayOfKey(key));
}

/**
 * L'agence est-elle ouverte à cet instant ?
 * Sans horaires configurés, on considère l'agence toujours ouverte (les commerces
 * qui n'ont rien paramétré ne doivent pas voir leur file bloquée).
 */
export function isOpenAt(hours: OpenHours | null, timeZone: string, date: Date): boolean {
  if (!hours) return true;
  const p = getZonedParts(date, timeZone);
  const range = getDayRange(hours, p.weekday);
  if (!range) return false;
  const minutes = p.hour * 60 + p.minute;
  return minutes >= range.open && minutes < range.close;
}

/** Prochaine ouverture (jour de semaine + heure « HH:MM ») dans les 7 jours, ou null.
 *  i = 7 couvre le même jour la semaine suivante (seul jour ouvert, déjà fermé aujourd'hui). */
export function nextOpening(
  hours: OpenHours | null,
  timeZone: string,
  date: Date
): { weekday: number; time: string; today: boolean } | null {
  if (!hours) return null;
  const p = getZonedParts(date, timeZone);
  const minutes = p.hour * 60 + p.minute;
  for (let i = 0; i <= 7; i++) {
    const weekday = (p.weekday + i) % 7;
    const range = getDayRange(hours, weekday);
    if (!range) continue;
    if (i === 0 && minutes >= range.open) continue;
    return { weekday, time: formatHm(range.open), today: i === 0 };
  }
  return null;
}
