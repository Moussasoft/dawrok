import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { publishBranchUpdate } from '@/lib/queue';
import { upsertCustomer } from '@/lib/tickets';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { getPlanLimits } from '@/lib/plans';
import { parseOpenHours } from '@/lib/opening-hours';
import { generateSlots, isSlotBookable, type SlotQuery } from '@/lib/slots';
import { DEFAULT_TIMEZONE, dayBounds, dayKey, parseDayKey } from '@/lib/time';
import { DEFAULT_SERVICE_MIN } from '@/lib/queue-logic';
import { routing } from '@/i18n/routing';
import { wantsSms } from '@/lib/sms-notify';

const MIN_LEAD_MIN = 30;
const MAX_DAYS_AHEAD = 90;
/** Statuts qui occupent un créneau (les RDV à venir sont `scheduled` : ils comptaient pour rien avant). */
const BOOKED_STATUSES = ['scheduled', 'waiting', 'called', 'in_progress'];

async function loadBookableBranch(qrToken: string) {
  const branch = await prisma.branch.findUnique({
    where: { qrToken },
    include: { services: { where: { active: true } }, organization: true },
  });
  if (!branch || !branch.active) throw new ApiError(404, 'branch_not_found');
  if (branch.organization.suspended) throw new ApiError(403, 'service_unavailable');
  const limits = await getPlanLimits(branch.organization.plan);
  if (!branch.allowBooking || !limits.allowBooking) throw new ApiError(403, 'booking_disabled');
  return branch;
}

type BookableBranch = Awaited<ReturnType<typeof loadBookableBranch>>;

async function buildSlotQuery(branch: BookableBranch, key: string, serviceId: string | null): Promise<SlotQuery> {
  const timeZone = branch.timezone || DEFAULT_TIMEZONE;
  const { start, end } = dayBounds(key, timeZone);
  const [capacity, existing] = await Promise.all([
    prisma.employee.count({ where: { branchId: branch.id, active: true } }),
    prisma.ticket.findMany({
      where: {
        branchId: branch.id,
        kind: 'appointment',
        status: { in: BOOKED_STATUSES },
        // Marge d'un jour : un RDV de la veille au soir peut déborder.
        scheduledFor: { gte: new Date(start.getTime() - 8 * 3600_000), lt: end },
      },
      select: { scheduledFor: true, service: { select: { avgDurationMin: true } } },
    }),
  ]);
  const service = branch.services.find((s) => s.id === serviceId);
  return {
    dayKey: key,
    timeZone,
    hours: parseOpenHours(branch.openHours),
    slotMin: branch.bookingSlotMin || 15,
    serviceDurationMin: service?.avgDurationMin ?? branch.bookingSlotMin ?? DEFAULT_SERVICE_MIN,
    capacity,
    bookings: existing
      .filter((b) => b.scheduledFor)
      .map((b) => ({ start: b.scheduledFor!, durationMin: b.service?.avgDurationMin ?? DEFAULT_SERVICE_MIN })),
    now: new Date(),
    minLeadMin: MIN_LEAD_MIN,
  };
}

const postSchema = z.object({
  qrToken: z.string().min(4).max(64),
  customerName: z.string().trim().min(1).max(80),
  customerPhone: z.string().trim().min(6).max(30),
  serviceId: z.string().max(64).optional().nullable(),
  scheduledFor: z.string().datetime(),
  locale: z.enum(routing.locales).optional(),
  notifySms: z.boolean().optional(),
});

// Endpoint public — réserver un rendez-vous.
export const POST = route(async (req) => {
  enforceRateLimit(`booking:ip:${clientIp(req)}`, 15, 60 * 60_000);
  const data = await parseBody(req, postSchema);
  const branch = await loadBookableBranch(data.qrToken);
  const timeZone = branch.timezone || DEFAULT_TIMEZONE;

  const scheduled = new Date(data.scheduledFor);
  const now = Date.now();
  if (scheduled.getTime() < now + MIN_LEAD_MIN * 60_000) throw new ApiError(400, 'slot_too_soon');
  if (scheduled.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) throw new ApiError(400, 'slot_too_far');

  // Pas de « réservation existante » renvoyée par téléphone : cela révélait le code et
  // l'heure du rendez-vous d'un tiers à quiconque connaissait son numéro.
  const serviceId = branch.services.some((s) => s.id === data.serviceId) ? data.serviceId! : null;
  const query = await buildSlotQuery(branch, dayKey(scheduled, timeZone), serviceId);
  if (!isSlotBookable(query, scheduled)) throw new ApiError(409, 'slot_unavailable');

  const notifySms = data.notifySms ? await wantsSms(branch.organization, data.customerPhone) : false;
  const customerId = await upsertCustomer(branch.id, data.customerPhone, data.customerName);
  // Les RDV restent `scheduled` (hors file) jusqu'à leur heure ; maintainQueue les promeut.
  const ticket = await prisma.ticket.create({
    data: {
      branchId: branch.id,
      number: 0,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerId,
      serviceId,
      kind: 'appointment',
      scheduledFor: scheduled,
      status: 'scheduled',
      cancelToken: crypto.randomBytes(16).toString('hex'),
      ...(data.locale ? { locale: data.locale } : {}),
      notifySms,
    },
  });

  // Deux réservations simultanées du dernier créneau : on revérifie après insertion et
  // on retire la nôtre si la capacité est dépassée (mieux vaut un refus qu'un surbooking).
  const after = await buildSlotQuery(branch, query.dayKey, serviceId);
  const end = scheduled.getTime() + after.serviceDurationMin * 60_000;
  const overlapping = after.bookings.filter(
    (b) => b.start.getTime() < end && b.start.getTime() + b.durationMin * 60_000 > scheduled.getTime()
  ).length;
  if (overlapping > Math.max(1, after.capacity)) {
    await prisma.ticket.delete({ where: { id: ticket.id } });
    throw new ApiError(409, 'slot_unavailable');
  }

  await publishBranchUpdate(branch.id);
  return NextResponse.json({ ok: true, publicCode: ticket.publicCode, scheduledFor: scheduled.toISOString() });
});

// Créneaux d'un jour (AAAA-MM-JJ, jour local de l'agence).
export const GET = route(async (req) => {
  enforceRateLimit(`slots:ip:${clientIp(req)}`, 120, 60_000);
  const qrToken = req.nextUrl.searchParams.get('qrToken');
  const date = req.nextUrl.searchParams.get('date');
  const serviceId = req.nextUrl.searchParams.get('serviceId');
  if (!qrToken || !date || !parseDayKey(date)) throw new ApiError(400, 'invalid_data');

  const branch = await loadBookableBranch(qrToken);
  const query = await buildSlotQuery(branch, date, serviceId);
  return NextResponse.json({ slots: generateSlots(query), timezone: query.timeZone });
});
