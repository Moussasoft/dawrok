import { describe, expect, it } from 'vitest';
import { generateSlots, isSlotBookable, type ExistingBooking, type SlotQuery } from './slots';

// Jeudi 24/09/2026 à Casablanca (UTC+1) : 09:00 locale = 08:00Z. Ouvert 09:00–12:00.
function query(over: Partial<SlotQuery> = {}): SlotQuery {
  return {
    dayKey: '2026-09-24',
    timeZone: 'Africa/Casablanca',
    hours: { thu: { open: '09:00', close: '12:00' } },
    slotMin: 15,
    serviceDurationMin: 30,
    capacity: 1,
    bookings: [],
    now: new Date('2026-09-23T12:00:00Z'), // la veille
    minLeadMin: 0,
    ...over,
  };
}

const times = (q: SlotQuery) => generateSlots(q).map((s) => s.time);
const unavailable = (q: SlotQuery) =>
  generateSlots(q)
    .filter((s) => !s.available)
    .map((s) => s.time);
const z = (hm: string) => `2026-09-24T${hm}:00.000Z`;
/** RDV de 60 min à 10:00 locale (09:00Z). */
const hourAt10: ExistingBooking = { start: new Date(z('09:00')), durationMin: 60 };

describe('generateSlots', () => {
  it('aligne les créneaux sur le pas depuis l’ouverture, en ISO UTC', () => {
    const slots = generateSlots(query());
    expect(slots).toHaveLength(11); // 09:00 → 11:30 locale
    expect(slots[0]).toEqual({ time: z('08:00'), available: true });
    expect(slots[1].time).toBe(z('08:15'));
    expect(slots.at(-1)?.time).toBe(z('10:30'));
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('part de l’heure d’ouverture même si elle n’est pas ronde', () => {
    const q = query({ hours: { thu: { open: '09:10', close: '10:00' } }, serviceDurationMin: 15 });
    expect(times(q)).toEqual([z('08:10'), z('08:25'), z('08:40')]);
  });

  it('exprime les créneaux dans le fuseau de l’agence', () => {
    expect(times(query({ timeZone: 'Europe/Paris' }))[0]).toBe(z('07:00'));
    expect(times(query({ timeZone: 'UTC' }))[0]).toBe(z('09:00'));
  });

  it('exige que la prestation se termine avant la fermeture', () => {
    expect(times(query({ serviceDurationMin: 60 })).at(-1)).toBe(z('10:00')); // 11:00 → 12:00 pile
    expect(times(query({ serviceDurationMin: 180 }))).toEqual([z('08:00')]);
    expect(times(query({ serviceDurationMin: 181 }))).toEqual([]);
  });

  it('ignore les créneaux avant maintenant + délai minimal', () => {
    // 09:20 locale + 30 min → premier créneau proposé : 10:00 locale.
    expect(times(query({ now: new Date(z('08:20')), minLeadMin: 30 }))[0]).toBe(z('09:00'));
    // Un créneau pile à la limite reste proposé, une minute plus tard il disparaît.
    expect(times(query({ now: new Date(z('08:30')), minLeadMin: 30 }))[0]).toBe(z('09:00'));
    expect(times(query({ now: new Date(z('08:31')), minLeadMin: 30 }))[0]).toBe(z('09:15'));
  });

  it('bloque les créneaux qui chevauchent un RDV de 60 min (capacité 1)', () => {
    const q = query({ serviceDurationMin: 15, bookings: [hourAt10] });
    // 09:45 (fin à 10:00) et 11:00 (début à la fin du RDV) restent libres.
    expect(unavailable(q)).toEqual([z('09:00'), z('09:15'), z('09:30'), z('09:45')]);
  });

  it('tient compte de la durée de la prestation demandée', () => {
    // Une prestation de 30 min à 09:45 locale déborderait sur le RDV de 10:00.
    const q = query({ serviceDurationMin: 30, bookings: [hourAt10] });
    expect(unavailable(q)).toEqual([z('08:45'), z('09:00'), z('09:15'), z('09:30'), z('09:45')]);
  });

  it('laisse le créneau libre tant que la capacité n’est pas atteinte', () => {
    expect(unavailable(query({ serviceDurationMin: 15, capacity: 2, bookings: [hourAt10] }))).toEqual([]);
    expect(unavailable(query({ serviceDurationMin: 15, capacity: 2, bookings: [hourAt10, hourAt10] }))).toHaveLength(4);
  });

  it('renvoie une liste vide un jour fermé', () => {
    expect(generateSlots(query({ hours: { thu: { closed: true } } }))).toEqual([]);
  });

  it('utilise 09:00–19:00 sans horaires configurés', () => {
    const t = times(query({ hours: null, slotMin: 60, serviceDurationMin: 60 }));
    expect(t).toHaveLength(10);
    expect(t[0]).toBe(z('08:00'));
    expect(t.at(-1)).toBe(z('17:00')); // 18:00 → 19:00 locale
  });

  it('impose un pas minimal de 5 minutes', () => {
    const q = query({ slotMin: 1, serviceDurationMin: 10, hours: { thu: { open: '09:00', close: '09:30' } } });
    expect(times(q)).toEqual([z('08:00'), z('08:05'), z('08:10'), z('08:15'), z('08:20')]);
  });
});

describe('isSlotBookable', () => {
  const q = query({ serviceDurationMin: 15, bookings: [hourAt10] });

  it('accepte un créneau aligné et libre', () => {
    expect(isSlotBookable(q, new Date(z('08:15')))).toBe(true);
  });

  it('refuse un horaire non aligné sur le pas', () => {
    expect(isSlotBookable(q, new Date(z('08:07')))).toBe(false);
  });

  it('refuse un créneau complet, sauf si la capacité le permet', () => {
    expect(isSlotBookable(q, new Date(z('09:30')))).toBe(false);
    expect(isSlotBookable({ ...q, capacity: 2 }, new Date(z('09:30')))).toBe(true);
  });

  it('refuse un créneau à la fermeture ou trop proche', () => {
    expect(isSlotBookable(q, new Date(z('11:00')))).toBe(false); // 12:00 locale
    expect(isSlotBookable({ ...q, now: new Date(z('08:00')), minLeadMin: 60 }, new Date(z('08:15')))).toBe(false);
  });
});
