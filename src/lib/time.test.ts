import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  dayBounds,
  dayKey,
  formatHm,
  getDayWindow,
  getTimeZoneOffsetMinutes,
  getZonedParts,
  isValidTimeZone,
  parseDayKey,
  parseHm,
  weekdayOfKey,
  zonedTimeToUtc,
} from './time';

// Casablanca est à UTC+1 hors ramadan (en 2026, UTC+0 du 15/02 au 22/03 environ) :
// on utilise donc des dates de septembre pour les assertions en UTC+1.
const CASA = 'Africa/Casablanca';
const PARIS = 'Europe/Paris';
const HOUR = 3_600_000;
const iso = (d: Date) => d.toISOString();

describe('getZonedParts', () => {
  it('décompose un instant dans le fuseau de Casablanca', () => {
    expect(getZonedParts(new Date('2026-09-24T12:34:56Z'), CASA)).toEqual({
      year: 2026,
      month: 9,
      day: 24,
      hour: 13,
      minute: 34,
      second: 56,
      weekday: 4, // jeudi
    });
  });

  it('renvoie l’heure 0 (et non 24) à minuit local', () => {
    expect(getZonedParts(new Date('2026-09-23T23:00:00Z'), CASA)).toMatchObject({ day: 24, hour: 0, minute: 0 });
    expect(getZonedParts(new Date('2026-09-24T00:00:00Z'), 'UTC').hour).toBe(0);
  });

  it('numérote les jours à partir de dimanche = 0, dans le fuseau demandé', () => {
    expect(getZonedParts(new Date('2026-09-27T10:00:00Z'), 'UTC').weekday).toBe(0); // dimanche
    expect(getZonedParts(new Date('2026-09-26T10:00:00Z'), 'UTC').weekday).toBe(6); // samedi
    // Samedi 23:30 UTC = déjà dimanche 00:30 à Casablanca.
    expect(getZonedParts(new Date('2026-09-26T23:30:00Z'), CASA).weekday).toBe(0);
  });

  it('suit l’heure d’été de Paris', () => {
    expect(getZonedParts(new Date('2026-07-14T10:00:00Z'), PARIS).hour).toBe(12);
    expect(getZonedParts(new Date('2026-12-14T10:00:00Z'), PARIS).hour).toBe(11);
  });
});

describe('getTimeZoneOffsetMinutes', () => {
  it('donne le décalage du fuseau à cet instant', () => {
    expect(getTimeZoneOffsetMinutes(new Date('2026-09-24T12:00:00Z'), CASA)).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), PARIS)).toBe(120);
    expect(getTimeZoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'), PARIS)).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date('2026-09-24T12:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('dayKey', () => {
  it('23:30 UTC le 23 est déjà le 24 à Casablanca', () => {
    const d = new Date('2026-09-23T23:30:00Z');
    expect(dayKey(d, CASA)).toBe('2026-09-24');
    expect(dayKey(d, 'UTC')).toBe('2026-09-23');
  });

  it('bascule exactement à minuit local', () => {
    expect(dayKey(new Date('2026-09-23T22:59:59Z'), CASA)).toBe('2026-09-23');
    expect(dayKey(new Date('2026-09-23T23:00:00Z'), CASA)).toBe('2026-09-24');
  });

  it('complète sur deux chiffres et change d’année au réveillon', () => {
    expect(dayKey(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
    expect(dayKey(new Date('2026-12-31T23:30:00Z'), CASA)).toBe('2027-01-01');
  });
});

describe('dayBounds / getDayWindow', () => {
  it('borne un jour entre deux minuits locaux exprimés en UTC', () => {
    const casa = dayBounds('2026-09-24', CASA);
    expect(iso(casa.start)).toBe('2026-09-23T23:00:00.000Z');
    expect(iso(casa.end)).toBe('2026-09-24T23:00:00.000Z');
    const utc = dayBounds('2026-09-24', 'UTC');
    expect(iso(utc.start)).toBe('2026-09-24T00:00:00.000Z');
    expect(iso(utc.end)).toBe('2026-09-25T00:00:00.000Z');
  });

  it('le jour du passage à l’heure d’été dure 23 h à Paris', () => {
    const { start, end } = dayBounds('2026-03-29', PARIS);
    expect(iso(start)).toBe('2026-03-28T23:00:00.000Z');
    expect(iso(end)).toBe('2026-03-29T22:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR);
  });

  it('le jour du retour à l’heure d’hiver dure 25 h à Paris', () => {
    const { start, end } = dayBounds('2026-10-25', PARIS);
    expect(iso(start)).toBe('2026-10-24T22:00:00.000Z');
    expect(iso(end)).toBe('2026-10-25T23:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(25 * HOUR);
  });

  it('rejette une clé invalide', () => {
    expect(() => dayBounds('2026-02-30', CASA)).toThrow(/Clé de jour invalide/);
  });

  it('getDayWindow renvoie la clé locale et des bornes qui contiennent l’instant', () => {
    const d = new Date('2026-09-23T23:30:00Z');
    const w = getDayWindow(d, CASA);
    expect(w.key).toBe('2026-09-24');
    expect(iso(w.start)).toBe('2026-09-23T23:00:00.000Z');
    expect(iso(w.end)).toBe('2026-09-24T23:00:00.000Z');
    expect(w.start.getTime()).toBeLessThanOrEqual(d.getTime());
    expect(d.getTime()).toBeLessThan(w.end.getTime());
  });
});

describe('zonedTimeToUtc', () => {
  it('convertit une heure murale en instant UTC', () => {
    expect(iso(zonedTimeToUtc(2026, 9, 24, 10, 0, CASA))).toBe('2026-09-24T09:00:00.000Z');
    expect(iso(zonedTimeToUtc(2026, 9, 24, 10, 0, PARIS))).toBe('2026-09-24T08:00:00.000Z');
    expect(iso(zonedTimeToUtc(2026, 9, 24, 10, 0, 'UTC'))).toBe('2026-09-24T10:00:00.000Z');
  });

  it('gère le passage à l’heure d’été à Paris (29/03/2026)', () => {
    expect(iso(zonedTimeToUtc(2026, 3, 29, 1, 30, PARIS))).toBe('2026-03-29T00:30:00.000Z'); // CET
    expect(iso(zonedTimeToUtc(2026, 3, 29, 3, 30, PARIS))).toBe('2026-03-29T01:30:00.000Z'); // CEST
    // 02:30 n'existe pas ce jour-là : l'heure est reportée après le saut (03:30 CEST).
    expect(iso(zonedTimeToUtc(2026, 3, 29, 2, 30, PARIS))).toBe('2026-03-29T01:30:00.000Z');
  });

  it('gère le retour à l’heure d’hiver à Paris (25/10/2026)', () => {
    expect(iso(zonedTimeToUtc(2026, 10, 25, 1, 30, PARIS))).toBe('2026-10-24T23:30:00.000Z'); // CEST
    expect(iso(zonedTimeToUtc(2026, 10, 25, 3, 30, PARIS))).toBe('2026-10-25T02:30:00.000Z'); // CET
    // 02:30 existe deux fois : l'une ou l'autre occurrence convient, tant qu'elle affiche 02:30.
    const ambiguous = zonedTimeToUtc(2026, 10, 25, 2, 30, PARIS);
    expect(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']).toContain(iso(ambiguous));
    expect(getZonedParts(ambiguous, PARIS)).toMatchObject({ day: 25, hour: 2, minute: 30 });
  });

  it('fait l’aller-retour avec getZonedParts à chaque quart d’heure', () => {
    const days: [string, string][] = [
      [CASA, '2026-09-24'],
      [CASA, '2026-12-31'],
      ['UTC', '2026-09-24'],
      [PARIS, '2026-03-29'],
      [PARIS, '2026-10-25'],
    ];
    const mismatches: string[] = [];
    for (const [tz, key] of days) {
      const { year, month, day } = parseDayKey(key)!;
      for (let m = 0; m < 24 * 60; m += 15) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        if (tz === PARIS && key === '2026-03-29' && hour === 2) continue; // heure inexistante
        const p = getZonedParts(zonedTimeToUtc(year, month, day, hour, minute, tz), tz);
        if (p.year !== year || p.month !== month || p.day !== day || p.hour !== hour || p.minute !== minute) {
          mismatches.push(`${tz} ${key} ${formatHm(m)} → ${p.day} ${p.hour}:${p.minute}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('addDaysToKey', () => {
  it.each([
    ['2026-09-24', 1, '2026-09-25'],
    ['2026-09-30', 1, '2026-10-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2028-02-28', 1, '2028-02-29'], // année bissextile
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-03-28', 2, '2026-03-30'], // indépendant du changement d'heure
    ['2026-09-24', 7, '2026-10-01'],
    ['2026-09-24', 0, '2026-09-24'],
  ])('%s + %i j = %s', (key, days, expected) => {
    expect(addDaysToKey(key, days)).toBe(expected);
  });

  it('rejette une clé invalide', () => {
    expect(() => addDaysToKey('2026-13-01', 1)).toThrow(/Clé de jour invalide/);
  });
});

describe('weekdayOfKey', () => {
  it('renvoie le jour de semaine (0 = dimanche)', () => {
    expect(weekdayOfKey('2026-09-24')).toBe(4);
    expect(weekdayOfKey('2026-09-26')).toBe(6);
    expect(weekdayOfKey('2026-09-27')).toBe(0);
    expect(weekdayOfKey('2028-02-29')).toBe(2);
  });

  it('rejette une clé invalide', () => {
    expect(() => weekdayOfKey('hier')).toThrow(/Clé de jour invalide/);
  });
});

describe('parseDayKey', () => {
  it('décompose une clé valide', () => {
    expect(parseDayKey('2026-09-24')).toEqual({ year: 2026, month: 9, day: 24 });
    expect(parseDayKey('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-09-00',
    '2026-9-24',
    '2026-09-24T10:00',
    ' 2026-09-24',
    '24/09/2026',
    'n’importe quoi',
    '',
  ])('rejette « %s »', (key) => {
    expect(parseDayKey(key)).toBeNull();
  });
});

describe('parseHm / formatHm', () => {
  it('convertit « HH:MM » en minutes depuis minuit', () => {
    expect(parseHm('00:00')).toBe(0);
    expect(parseHm('09:00')).toBe(540);
    expect(parseHm('19:30')).toBe(1170);
    expect(parseHm('23:59')).toBe(1439);
  });

  it.each(['24:00', '9:00', '09:60', '09:5', '09:00:00', 'ab:cd', ''])('rejette « %s »', (value) => {
    expect(parseHm(value)).toBeNull();
  });

  it('accepte null et undefined', () => {
    expect(parseHm(null)).toBeNull();
    expect(parseHm(undefined)).toBeNull();
  });

  it('formate des minutes en « HH:MM », inverse de parseHm', () => {
    expect(formatHm(0)).toBe('00:00');
    expect(formatHm(75)).toBe('01:15');
    expect(formatHm(1439)).toBe('23:59');
    for (const v of ['00:00', '08:05', '12:30', '23:59']) expect(formatHm(parseHm(v)!)).toBe(v);
  });
});

describe('isValidTimeZone', () => {
  it('accepte les fuseaux IANA', () => {
    expect(isValidTimeZone(CASA)).toBe(true);
    expect(isValidTimeZone(PARIS)).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('refuse les fuseaux inconnus', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('pas un fuseau')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
