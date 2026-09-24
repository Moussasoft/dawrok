// Formatage localisé, utilisable côté serveur comme côté client.
// L'arabe utilise « ar-MA » : chiffres latins et noms de mois marocains.

const INTL_LOCALES: Record<string, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-GB' };

export function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}

function fmt(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(intlLocale(locale), options);
}

export function formatTime(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmt(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}

export function formatDateTime(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmt(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}

export function formatLongDateTime(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmt(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone }).format(
    new Date(value)
  );
}

export function formatDate(value: Date | string | number, locale: string, timeZone?: string): string {
  return fmt(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(new Date(value));
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
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
