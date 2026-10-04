// Formatage localisé, utilisable côté serveur comme côté client.
// L'arabe utilise « ar-MA » : chiffres latins et noms de mois marocains.
import { effectiveTimeZone } from './time';

const INTL_LOCALES: Record<string, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-GB' };

export function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}

function fmt(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(intlLocale(locale), options);
}

/** Formate un instant dans un fuseau, corrigé si la base tz du moteur date (voir `effectiveTimeZone`). */
function fmtAt(value: Date | string | number, locale: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  return fmt(locale, { ...options, timeZone: timeZone ? effectiveTimeZone(timeZone, date) : undefined }).format(date);
}

export function formatTime(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmtAt(value, locale, timeZone, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmtAt(value, locale, timeZone, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatLongDateTime(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmtAt(value, locale, timeZone, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmtAt(value, locale, timeZone, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** Nombre à décimales fixes (ex. note moyenne « 4,5 »). */
export function formatDecimal(value: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Nom court du jour de semaine (0 = dimanche), dans la langue. */
export function weekdayName(weekday: number, locale: string, style: 'short' | 'long' = 'short'): string {
  // 4 janvier 1970 était un dimanche.
  return fmt(locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(1970, 0, 4 + weekday)));
}

/** Libellé d'un jour « AAAA-MM-JJ » (jour de semaine, jour, mois) sans dépendre du fuseau. */
export function dayKeyParts(key: string, locale: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: fmt(locale, { weekday: 'short', timeZone: 'UTC' }).format(date),
    day: d,
    month: fmt(locale, { month: 'short', timeZone: 'UTC' }).format(date),
  };
}

export function formatDuration(minutes: number, locale: string): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} ${locale === 'ar' ? 'د' : 'min'}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hLabel = locale === 'ar' ? 'س' : 'h';
  return rest === 0 ? `${h} ${hLabel}` : `${h} ${hLabel} ${String(rest).padStart(2, '0')}`;
}

export function ticketLabel(n: number): string {
  return String(n).padStart(3, '0');
}
