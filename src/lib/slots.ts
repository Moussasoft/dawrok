// Génération des créneaux de réservation (logique pure, testée).
import type { OpenHours } from './opening-hours';
import { getDayRangeForKey } from './opening-hours';
import { parseDayKey, zonedTimeToUtc } from './time';

export type ExistingBooking = { start: Date; durationMin: number };

export type SlotQuery = {
  dayKey: string;
  timeZone: string;
  hours: OpenHours | null;
  slotMin: number;
  /** Durée de la prestation demandée : un créneau n'est libre que si la prestation tient avant la fermeture. */
  serviceDurationMin: number;
  /** Nombre de prestations simultanées possibles (employés actifs). */
  capacity: number;
  bookings: ExistingBooking[];
  now: Date;
  /** Délai minimal avant un créneau (minutes). */
  minLeadMin: number;
};

export type Slot = { time: string; available: boolean };

export function generateSlots(q: SlotQuery): Slot[] {
  const day = parseDayKey(q.dayKey);
  if (!day) return [];
  const range = getDayRangeForKey(q.hours, q.dayKey);
  if (!range) return [];
  const step = Math.max(5, q.slotMin);
  const duration = Math.max(1, q.serviceDurationMin);
  const capacity = Math.max(1, q.capacity);
  const earliest = q.now.getTime() + q.minLeadMin * 60_000;
  const slots: Slot[] = [];

  for (let m = range.open; m + duration <= range.close; m += step) {
    const start = zonedTimeToUtc(day.year, day.month, day.day, Math.floor(m / 60), m % 60, q.timeZone);
    if (start.getTime() < earliest) continue;
    const end = start.getTime() + duration * 60_000;
    // Chevauchement : un RDV de 60 min à 10:00 occupe aussi 10:15, 10:30, 10:45.
    const overlapping = q.bookings.filter((b) => {
      const bStart = b.start.getTime();
      const bEnd = bStart + b.durationMin * 60_000;
      return bStart < end && bEnd > start.getTime();
    }).length;
    slots.push({ time: start.toISOString(), available: overlapping < capacity });
  }
  return slots;
}

/** Le créneau demandé fait-il partie des créneaux libres ? (validation côté serveur) */
export function isSlotBookable(q: SlotQuery, requested: Date): boolean {
  const iso = requested.toISOString();
  return generateSlots(q).some((s) => s.time === iso && s.available);
}
