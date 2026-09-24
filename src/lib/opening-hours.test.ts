import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLOSE,
  DEFAULT_OPEN,
  getDayRange,
  getDayRangeForKey,
  isOpenAt,
  nextOpening,
  parseOpenHours,
  type OpenHours,
} from './opening-hours';
import { WEEKDAYS } from './time';

// Jeudi 24/09/2026 à Casablanca (UTC+1) : 08:00Z = 09:00 locale.
const CASA = 'Africa/Casablanca';
const json = (v: unknown) => JSON.stringify(v);
/** Horaires où seul le jour `day` est ouvert. */
const onlyDay = (day: string, open: string, close: string) =>
  Object.fromEntries(WEEKDAYS.map((d) => [d, d === day ? { open, close } : { closed: true }])) as OpenHours;

describe('parseOpenHours', () => {
  it('renvoie null sans valeur', () => {
    expect(parseOpenHours(null)).toBeNull();
    expect(parseOpenHours(undefined)).toBeNull();
    expect(parseOpenHours('')).toBeNull();
  });

  it('renvoie null pour un JSON invalide ou qui n’est pas un objet', () => {
    expect(parseOpenHours('{mon: 09:00')).toBeNull();
    expect(parseOpenHours('[]')).toBeNull();
    expect(parseOpenHours('null')).toBeNull();
  });

  it('lit des horaires valides', () => {
    const hours = { mon: { open: '08:30', close: '18:00' }, sun: { closed: true } };
    expect(parseOpenHours(json(hours))).toEqual(hours);
  });

  it('rejette une ouverture postérieure ou égale à la fermeture', () => {
    expect(parseOpenHours(json({ mon: { open: '19:00', close: '09:00' } }))).toBeNull();
    expect(parseOpenHours(json({ mon: { open: '09:00', close: '09:00' } }))).toBeNull();
  });

  it('rejette une heure mal formée', () => {
    expect(parseOpenHours(json({ mon: { open: '9:00', close: '18:00' } }))).toBeNull();
    expect(parseOpenHours(json({ mon: { open: '09:00', close: '24:00' } }))).toBeNull();
  });

  it('tolère des heures incohérentes sur un jour fermé', () => {
    expect(parseOpenHours(json({ mon: { closed: true, open: '19:00', close: '09:00' } }))).not.toBeNull();
  });
});

describe('getDayRange', () => {
  it('applique 09:00–19:00 par défaut pour un jour absent', () => {
    expect([DEFAULT_OPEN, DEFAULT_CLOSE]).toEqual(['09:00', '19:00']);
    expect(getDayRange({}, 1)).toEqual({ open: 540, close: 1140 });
    expect(getDayRange(null, 0)).toEqual({ open: 540, close: 1140 });
  });

  it('renvoie null pour un jour marqué closed', () => {
    expect(getDayRange({ sun: { closed: true } }, 0)).toBeNull();
  });

  it('lit les horaires du bon jour (0 = dimanche)', () => {
    const hours: OpenHours = {
      sun: { closed: true },
      mon: { open: '10:00', close: '14:00' },
      sat: { open: '08:00', close: '12:30' },
    };
    expect(getDayRange(hours, 1)).toEqual({ open: 600, close: 840 });
    expect(getDayRange(hours, 6)).toEqual({ open: 480, close: 750 });
    expect(getDayRange(hours, 2)).toEqual({ open: 540, close: 1140 });
  });

  it('complète une heure manquante par la valeur par défaut', () => {
    expect(getDayRange({ mon: { open: '07:00' } }, 1)).toEqual({ open: 420, close: 1140 });
    expect(getDayRange({ mon: { close: '12:00' } }, 1)).toEqual({ open: 540, close: 720 });
    // Ouverture après la fermeture par défaut (19:00) : jour considéré fermé.
    expect(getDayRange({ mon: { open: '20:00' } }, 1)).toBeNull();
  });

  it('getDayRangeForKey utilise le jour de semaine de la clé', () => {
    expect(getDayRangeForKey({ thu: { open: '10:00', close: '12:00' } }, '2026-09-24')).toEqual({ open: 600, close: 720 });
    expect(getDayRangeForKey({ sun: { closed: true } }, '2026-09-27')).toBeNull();
  });
});

describe('isOpenAt', () => {
  const hours: OpenHours = { thu: { open: '09:00', close: '18:00' }, sun: { closed: true } };

  it('considère l’agence toujours ouverte sans horaires configurés', () => {
    expect(isOpenAt(null, CASA, new Date('2026-09-27T02:00:00Z'))).toBe(true);
  });

  it('inclut l’heure d’ouverture et exclut l’heure de fermeture', () => {
    expect(isOpenAt(hours, CASA, new Date('2026-09-24T07:59:00Z'))).toBe(false); // 08:59
    expect(isOpenAt(hours, CASA, new Date('2026-09-24T08:00:00Z'))).toBe(true); // 09:00
    expect(isOpenAt(hours, CASA, new Date('2026-09-24T16:59:00Z'))).toBe(true); // 17:59
    expect(isOpenAt(hours, CASA, new Date('2026-09-24T17:00:00Z'))).toBe(false); // 18:00
  });

  it('est fermée un jour marqué closed', () => {
    expect(isOpenAt(hours, CASA, new Date('2026-09-27T11:00:00Z'))).toBe(false); // dimanche midi
  });

  it('applique les horaires par défaut quand l’objet est vide', () => {
    expect(isOpenAt({}, CASA, new Date('2026-09-24T07:30:00Z'))).toBe(false); // 08:30
    expect(isOpenAt({}, CASA, new Date('2026-09-24T08:30:00Z'))).toBe(true); // 09:30
  });

  it('raisonne dans le fuseau de l’agence, pas celui de la machine', () => {
    const at = new Date('2026-09-24T08:30:00Z'); // 08:30 UTC = 09:30 à Casablanca
    expect(isOpenAt(hours, 'UTC', at)).toBe(false);
    expect(isOpenAt(hours, CASA, at)).toBe(true);
    // Le jour de semaine aussi : jeudi 23:30 UTC = vendredi 00:30 à Casablanca.
    const night: OpenHours = { thu: { closed: true }, fri: { open: '00:00', close: '12:00' } };
    const late = new Date('2026-09-24T23:30:00Z');
    expect(isOpenAt(night, 'UTC', late)).toBe(false);
    expect(isOpenAt(night, CASA, late)).toBe(true);
  });
});

describe('nextOpening', () => {
  const hours: OpenHours = {
    mon: { open: '08:30', close: '17:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '10:00', close: '18:00' },
    sat: { open: '09:00', close: '13:00' },
    sun: { closed: true },
  };

  it('renvoie null sans horaires configurés', () => {
    expect(nextOpening(null, CASA, new Date('2026-09-24T06:00:00Z'))).toBeNull();
  });

  it('renvoie l’ouverture du jour si elle est encore à venir', () => {
    expect(nextOpening(hours, CASA, new Date('2026-09-24T06:00:00Z'))).toEqual({ weekday: 4, time: '09:00', today: true });
  });

  it('passe à un autre jour une fois l’heure d’ouverture atteinte', () => {
    const friday = { weekday: 5, time: '10:00', today: false };
    expect(nextOpening(hours, CASA, new Date('2026-09-24T08:00:00Z'))).toEqual(friday); // 09:00 pile
    expect(nextOpening(hours, CASA, new Date('2026-09-24T20:00:00Z'))).toEqual(friday); // 21:00
  });

  it('saute les jours fermés', () => {
    // Samedi 15:00 → dimanche fermé → lundi 08:30.
    expect(nextOpening(hours, CASA, new Date('2026-09-26T14:00:00Z'))).toEqual({ weekday: 1, time: '08:30', today: false });
  });

  it('utilise le fuseau de l’agence', () => {
    const at = new Date('2026-09-24T08:30:00Z'); // 08:30 UTC, 09:30 à Casablanca
    expect(nextOpening(hours, 'UTC', at)).toEqual({ weekday: 4, time: '09:00', today: true });
    expect(nextOpening(hours, CASA, at)).toEqual({ weekday: 5, time: '10:00', today: false });
  });

  it('renvoie null si tous les jours sont fermés', () => {
    const allClosed = Object.fromEntries(WEEKDAYS.map((d) => [d, { closed: true }])) as OpenHours;
    expect(nextOpening(allClosed, CASA, new Date('2026-09-24T06:00:00Z'))).toBeNull();
  });

  it('trouve le seul jour ouvert quand il est encore à venir', () => {
    expect(nextOpening(onlyDay('thu', '09:00', '13:00'), CASA, new Date('2026-09-23T12:00:00Z'))).toEqual({
      weekday: 4,
      time: '09:00',
      today: false,
    });
  });

  // BUG : la boucle ne teste que i = 0..6 ; le même jour de la semaine suivante (i = 7) n'est
  // jamais examiné. Une agence ouverte un seul jour par semaine n'a donc plus de « prochaine
  // ouverture » dès que l'heure d'ouverture de ce jour est passée.
  it('retrouve le même jour la semaine suivante quand c’est le seul jour ouvert', () => {
    // Jeudi 14:00 : prochaine ouverture = jeudi suivant 09:00 (dans moins de 7 jours).
    expect(nextOpening(onlyDay('thu', '09:00', '13:00'), CASA, new Date('2026-09-24T13:00:00Z'))).toEqual({
      weekday: 4,
      time: '09:00',
      today: false,
    });
  });
});
