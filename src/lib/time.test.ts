import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  dayBounds,
  dayKey,
  effectiveTimeZone,
  formatHm,
  getDayWindow,
  getTimeZoneOffsetMinutes,
  getZonedParts,
  hasOutdatedZoneRules,
  isValidTimeZone,
  parseDayKey,
  parseHm,
  resolveTimeZone,
  weekdayOfKey,
  zonedTimeToUtc,
  type EngineOffset,
} from './time';

// Les règles d'un fuseau réel changent (le Maroc est repassé à UTC+0 le 20/09/2026) et la base tz
// embarquée dépend de la version de Node : la logique est donc testée avec un fuseau à décalage
// fixe. « Etc/GMT-1 » vaut UTC+1 toute l'année (signe inversé, convention POSIX).
// Paris sert aux changements d'heure : ses règles n'ont pas bougé depuis 1996.
const UTC_PLUS_1 = 'Etc/GMT-1';
const PARIS = 'Europe/Paris';
const CASA = 'Africa/Casablanca'; // ses règles ne sont vérifiées que dans les derniers blocs
const HOUR = 3_600_000;
const iso = (d: Date) => d.toISOString();

describe('getZonedParts', () => {
  it('décompose un instant dans le fuseau demandé', () => {
    expect(getZonedParts(new Date('2026-09-24T12:34:56Z'), UTC_PLUS_1)).toEqual({
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
    expect(getZonedParts(new Date('2026-09-23T23:00:00Z'), UTC_PLUS_1)).toMatchObject({ day: 24, hour: 0, minute: 0 });
    expect(getZonedParts(new Date('2026-09-24T00:00:00Z'), 'UTC').hour).toBe(0);
  });

  it('numérote les jours à partir de dimanche = 0, dans le fuseau demandé', () => {
    expect(getZonedParts(new Date('2026-09-27T10:00:00Z'), 'UTC').weekday).toBe(0); // dimanche
    expect(getZonedParts(new Date('2026-09-26T10:00:00Z'), 'UTC').weekday).toBe(6); // samedi
    // Samedi 23:30 UTC = déjà dimanche 00:30 en UTC+1.
    expect(getZonedParts(new Date('2026-09-26T23:30:00Z'), UTC_PLUS_1).weekday).toBe(0);
  });

  it('suit l’heure d’été de Paris', () => {
    expect(getZonedParts(new Date('2026-07-14T10:00:00Z'), PARIS).hour).toBe(12);
    expect(getZonedParts(new Date('2026-12-14T10:00:00Z'), PARIS).hour).toBe(11);
  });
});

describe('getTimeZoneOffsetMinutes', () => {
  it('donne le décalage du fuseau à cet instant', () => {
    expect(getTimeZoneOffsetMinutes(new Date('2026-09-24T12:00:00Z'), UTC_PLUS_1)).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), PARIS)).toBe(120);
    expect(getTimeZoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'), PARIS)).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date('2026-09-24T12:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('dayKey', () => {
  it('23:30 UTC le 23 est déjà le 24 en UTC+1', () => {
    const d = new Date('2026-09-23T23:30:00Z');
    expect(dayKey(d, UTC_PLUS_1)).toBe('2026-09-24');
    expect(dayKey(d, 'UTC')).toBe('2026-09-23');
  });

  it('bascule exactement à minuit local', () => {
    expect(dayKey(new Date('2026-09-23T22:59:59Z'), UTC_PLUS_1)).toBe('2026-09-23');
    expect(dayKey(new Date('2026-09-23T23:00:00Z'), UTC_PLUS_1)).toBe('2026-09-24');
  });

  it('complète sur deux chiffres et change d’année au réveillon', () => {
    expect(dayKey(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
    expect(dayKey(new Date('2026-12-31T23:30:00Z'), UTC_PLUS_1)).toBe('2027-01-01');
  });
});

describe('dayBounds / getDayWindow', () => {
  it('borne un jour entre deux minuits locaux exprimés en UTC', () => {
    const plus1 = dayBounds('2026-09-24', UTC_PLUS_1);
    expect(iso(plus1.start)).toBe('2026-09-23T23:00:00.000Z');
    expect(iso(plus1.end)).toBe('2026-09-24T23:00:00.000Z');
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
    expect(() => dayBounds('2026-02-30', UTC_PLUS_1)).toThrow(/Clé de jour invalide/);
  });

  it('getDayWindow renvoie la clé locale et des bornes qui contiennent l’instant', () => {
    const d = new Date('2026-09-23T23:30:00Z');
    const w = getDayWindow(d, UTC_PLUS_1);
    expect(w.key).toBe('2026-09-24');
    expect(iso(w.start)).toBe('2026-09-23T23:00:00.000Z');
    expect(iso(w.end)).toBe('2026-09-24T23:00:00.000Z');
    expect(w.start.getTime()).toBeLessThanOrEqual(d.getTime());
    expect(d.getTime()).toBeLessThan(w.end.getTime());
  });
});

describe('zonedTimeToUtc', () => {
  it('convertit une heure murale en instant UTC', () => {
    expect(iso(zonedTimeToUtc(2026, 9, 24, 10, 0, UTC_PLUS_1))).toBe('2026-09-24T09:00:00.000Z');
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
      [UTC_PLUS_1, '2026-09-24'],
      [UTC_PLUS_1, '2026-12-31'],
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

// Règles réelles du Maroc. Décret n° 2.26.530 : retour définitif à GMT le dimanche 20/09/2026 à
// 02:00, sans changement d'heure pendant le ramadan (tzdata 2026c). Ces tests passent quelle que
// soit la base tz du runtime : un moteur plus ancien (Node 22.11, tzdata 2023c) place encore
// Casablanca à UTC+1, et `effectiveTimeZone` calcule alors en UTC à partir de la bascule.
describe('Africa/Casablanca : retour à GMT du 20/09/2026', () => {
  const EL_AAIUN = 'Africa/El_Aaiun';

  it(`est à UTC+1 avant la bascule et à UTC+0 ensuite (base tz du runtime : ${process.versions.tz ?? 'inconnue'})`, () => {
    expect(getTimeZoneOffsetMinutes(new Date('2026-06-15T12:00:00Z'), CASA)).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date('2026-09-20T00:59:59Z'), CASA)).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date('2026-09-20T01:00:00Z'), CASA)).toBe(0);
    expect(getTimeZoneOffsetMinutes(new Date('2026-10-01T12:00:00Z'), CASA)).toBe(0);
    expect(getTimeZoneOffsetMinutes(new Date('2026-10-01T12:00:00Z'), EL_AAIUN)).toBe(0);
  });

  it('ne repasse plus à UTC+1 après le ramadan', () => {
    expect(getTimeZoneOffsetMinutes(new Date('2027-01-15T12:00:00Z'), CASA)).toBe(0);
    expect(getTimeZoneOffsetMinutes(new Date('2027-06-15T12:00:00Z'), CASA)).toBe(0);
    expect(getTimeZoneOffsetMinutes(new Date('2030-08-01T12:00:00Z'), CASA)).toBe(0);
  });

  it('donne l’heure marocaine réelle : 11:38 UTC = 11:38 à Casablanca', () => {
    expect(getZonedParts(new Date('2026-10-04T11:38:33Z'), CASA)).toMatchObject({ day: 4, hour: 11, minute: 38, weekday: 0 });
    expect(dayKey(new Date('2026-10-04T23:30:00Z'), CASA)).toBe('2026-10-04');
    expect(iso(zonedTimeToUtc(2026, 10, 5, 9, 0, CASA))).toBe('2026-10-05T09:00:00.000Z');
    const { start, end } = dayBounds('2026-10-05', CASA);
    expect(iso(start)).toBe('2026-10-05T00:00:00.000Z');
    expect(iso(end)).toBe('2026-10-06T00:00:00.000Z');
  });

  it('le jour du retour à GMT dure 25 h (l’heure 01:00–02:00 a lieu deux fois)', () => {
    const { start, end } = dayBounds('2026-09-20', CASA);
    expect(iso(start)).toBe('2026-09-19T23:00:00.000Z');
    expect(iso(end)).toBe('2026-09-21T00:00:00.000Z');
  });

  it('accepte le nom du fuseau sans tenir compte de la casse', () => {
    expect(getTimeZoneOffsetMinutes(new Date('2026-10-01T12:00:00Z'), 'africa/casablanca')).toBe(0);
  });
});

describe('resolveTimeZone', () => {
  const SWITCH = Date.UTC(2026, 8, 20, 1);
  /** Moteur à l'ancienne règle : le Maroc reste à UTC+1. */
  const outdated: EngineOffset = (_instant, zone) => (zone === 'UTC' ? 0 : 60);
  /** Moteur à jour : UTC+0 depuis la bascule. */
  const upToDate: EngineOffset = (instant, zone) => (zone === 'UTC' || instant >= SWITCH ? 0 : 60);

  it('remplace le fuseau par UTC à partir de la bascule quand le moteur ignore la règle', () => {
    expect(resolveTimeZone(CASA, SWITCH, outdated)).toBe('UTC');
    expect(resolveTimeZone(CASA, Date.UTC(2027, 5, 1), outdated)).toBe('UTC');
    expect(resolveTimeZone('Africa/El_Aaiun', SWITCH, outdated)).toBe('UTC');
  });

  it('garde le fuseau avant la bascule : l’histoire reste celle du moteur', () => {
    expect(resolveTimeZone(CASA, SWITCH - 1, outdated)).toBe(CASA);
    expect(resolveTimeZone(CASA, Date.UTC(2026, 2, 1), outdated)).toBe(CASA);
  });

  it('ne touche à rien quand le moteur connaît la règle', () => {
    expect(resolveTimeZone(CASA, SWITCH, upToDate)).toBe(CASA);
    expect(resolveTimeZone(CASA, Date.UTC(2027, 5, 1), upToDate)).toBe(CASA);
  });

  it('ne concerne que les fuseaux marocains', () => {
    expect(resolveTimeZone(PARIS, SWITCH, outdated)).toBe(PARIS);
    expect(resolveTimeZone('UTC', SWITCH, outdated)).toBe('UTC');
    expect(resolveTimeZone(UTC_PLUS_1, SWITCH, outdated)).toBe(UTC_PLUS_1);
  });

  it('laisse passer un instant invalide', () => {
    expect(resolveTimeZone(CASA, Number.NaN, outdated)).toBe(CASA);
  });
});

describe('effectiveTimeZone / hasOutdatedZoneRules', () => {
  it('suit la base tz du runtime', () => {
    const after = new Date('2026-10-04T12:00:00Z');
    expect(effectiveTimeZone(PARIS, after)).toBe(PARIS);
    expect(effectiveTimeZone(CASA, new Date('2026-09-01T12:00:00Z'))).toBe(CASA);
    // Runtime à jour : aucun remplacement. Runtime plus ancien : UTC, et le contrôle le signale.
    expect(effectiveTimeZone(CASA, after)).toBe(hasOutdatedZoneRules() ? 'UTC' : CASA);
  });
});
