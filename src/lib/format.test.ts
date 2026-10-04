import { describe, expect, it } from 'vitest';
import {
  dayKeyParts,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatDuration,
  formatLongDateTime,
  formatNumber,
  formatTime,
  intlLocale,
  ticketLabel,
  weekdayName,
} from './format';

// Fuseau à décalage fixe UTC+1 (signe inversé, convention POSIX) : pas de règle, donc aucune
// dépendance à la base tz du runtime.
const UTC_PLUS_1 = 'Etc/GMT-1';
/** Chiffres arabes orientaux (٠-٩) et persans (۰-۹) : interdits, l'app affiche des chiffres latins. */
const EASTERN_DIGITS = /[٠-٩۰-۹]/;

describe('intlLocale', () => {
  it('associe chaque langue de l’app à une locale Intl', () => {
    expect(intlLocale('ar')).toBe('ar-MA');
    expect(intlLocale('fr')).toBe('fr-FR');
    expect(intlLocale('en')).toBe('en-GB');
    expect(intlLocale('es')).toBe('es');
  });
});

describe('weekdayName', () => {
  it('0 = dimanche, en français et en anglais', () => {
    expect(weekdayName(0, 'fr')).toBe('dim.');
    expect(weekdayName(0, 'en')).toBe('Sun');
    expect(weekdayName(0, 'en', 'long')).toBe('Sunday');
    expect(weekdayName(1, 'fr', 'long')).toBe('lundi');
    expect(weekdayName(6, 'en')).toBe('Sat');
  });

  it('donne sept noms distincts en arabe', () => {
    expect(new Set([0, 1, 2, 3, 4, 5, 6].map((d) => weekdayName(d, 'ar'))).size).toBe(7);
  });
});

describe('dayKeyParts', () => {
  it('décompose une clé de jour', () => {
    expect(dayKeyParts('2026-09-24', 'fr')).toEqual({ weekday: 'jeu.', day: 24, month: 'sept.' });
    expect(dayKeyParts('2026-09-24', 'en')).toMatchObject({ weekday: 'Thu', day: 24 });
    expect(dayKeyParts('2026-09-27', 'ar').weekday).toBe(weekdayName(0, 'ar'));
  });

  it('ne dépend pas du fuseau de la machine', () => {
    const original = process.env.TZ;
    const results = new Set<string>();
    try {
      for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Africa/Casablanca']) {
        process.env.TZ = tz; // UTC+14 et UTC−11 : les deux extrêmes
        results.add(JSON.stringify([dayKeyParts('2026-09-24', 'fr'), dayKeyParts('2027-01-01', 'en')]));
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect([...results]).toHaveLength(1);
    expect(JSON.parse([...results][0])[0]).toEqual({ weekday: 'jeu.', day: 24, month: 'sept.' });
  });
});

describe('ticketLabel', () => {
  it('complète le numéro sur 3 chiffres', () => {
    expect(ticketLabel(0)).toBe('000');
    expect(ticketLabel(7)).toBe('007');
    expect(ticketLabel(42)).toBe('042');
    expect(ticketLabel(123)).toBe('123');
    expect(ticketLabel(1234)).toBe('1234');
  });
});

describe('formatDuration', () => {
  it('affiche les minutes sous une heure', () => {
    expect(formatDuration(45, 'fr')).toBe('45 min');
    expect(formatDuration(45, 'ar')).toBe('45 د');
  });

  it('affiche heures et minutes au-delà', () => {
    expect(formatDuration(75, 'fr')).toBe('1 h 15');
    expect(formatDuration(125, 'en')).toBe('2 h 05');
    expect(formatDuration(120, 'fr')).toBe('2 h');
    expect(formatDuration(75, 'ar')).toBe('1 س 15');
  });

  it('arrondit et ne descend pas sous zéro', () => {
    expect(formatDuration(59.6, 'fr')).toBe('1 h');
    expect(formatDuration(-3, 'fr')).toBe('0 min');
  });
});

describe('formatTime et formats de date', () => {
  const d = new Date('2026-09-24T09:05:00Z');

  it('affiche l’heure dans le fuseau demandé', () => {
    expect(formatTime(d, 'fr', UTC_PLUS_1)).toBe('10:05');
    expect(formatTime(d, 'en', UTC_PLUS_1)).toBe('10:05');
    expect(formatTime(d, 'fr', 'Europe/Paris')).toBe('11:05');
    expect(formatTime('2026-09-24T09:05:00Z', 'fr', 'UTC')).toBe('09:05');
  });

  it('utilise des chiffres latins en arabe (ar-MA)', () => {
    const time = formatTime(d, 'ar', UTC_PLUS_1);
    expect(time).toContain('10:05');
    expect(time).not.toMatch(EASTERN_DIGITS);
    expect(formatDate(d, 'ar', UTC_PLUS_1)).toMatch(/24.*2026/);
    for (const text of [formatDateTime(d, 'ar', UTC_PLUS_1), formatLongDateTime(d, 'ar', UTC_PLUS_1), formatNumber(1234.5, 'ar')]) {
      expect(text).not.toMatch(EASTERN_DIGITS);
    }
  });

  it('affiche l’heure marocaine réelle, quelle que soit la base tz du runtime', () => {
    // Maroc à UTC+1 jusqu'au 20/09/2026, à UTC+0 ensuite (voir effectiveTimeZone dans time.ts).
    const CASA = 'Africa/Casablanca';
    expect(formatTime('2026-09-01T11:38:00Z', 'fr', CASA)).toBe('12:38');
    expect(formatTime('2026-10-04T11:38:00Z', 'fr', CASA)).toBe('11:38');
    expect(formatTime('2026-10-04T11:38:00Z', 'ar', CASA)).toContain('11:38');
    // 23:30 UTC le 4 : encore le 4 au Maroc (c'était déjà le 5 à UTC+1).
    expect(formatDateTime('2026-10-04T23:30:00Z', 'fr', CASA)).toMatch(/^4 oct.*23:30$/);
    expect(formatLongDateTime('2026-10-04T23:30:00Z', 'fr', CASA)).toMatch(/^dimanche 4 octobre.*23:30$/);
    expect(formatDate('2026-10-04T23:30:00Z', 'fr', CASA)).toMatch(/^4 oct/);
  });

  it('utilise le fuseau de la machine sans fuseau demandé', () => {
    const at = new Date('2026-10-04T11:38:00Z');
    const machine = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(at);
    expect(formatTime(at, 'fr')).toBe(machine);
  });

  it('formate les nombres selon la langue', () => {
    expect(formatNumber(1234.5, 'fr')).toMatch(/^1\s234,5$/);
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
  });
});

describe('formatDecimal', () => {
  it('affiche une décimale avec le séparateur de la langue, en chiffres latins', () => {
    expect(formatDecimal(4.5, 'fr')).toBe('4,5');
    expect(formatDecimal(4, 'en')).toBe('4.0');
    expect(formatDecimal(3.25, 'ar')).not.toMatch(EASTERN_DIGITS);
  });
});
