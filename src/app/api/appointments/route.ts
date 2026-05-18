import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({
  qrToken: z.string().min(4),
  customerName: z.string().min(1).max(80),
  customerPhone: z.string().min(6).max(30), // required for appointments
  serviceId: z.string().optional().nullable(),
  scheduledFor: z.string().datetime(),
});

// Public endpoint — book a future appointment
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const branch = await prisma.branch.findUnique({
    where: { qrToken: parsed.data.qrToken },
    include: { services: true, organization: true },
  });
  if (!branch || !branch.active) {
    return NextResponse.json({ error: 'Point de service introuvable' }, { status: 404 });
  }
  if (branch.organization.suspended) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 403 });
  }
  if (!branch.allowBooking) {
    return NextResponse.json({ error: 'Réservation désactivée' }, { status: 403 });
  }
  const scheduled = new Date(parsed.data.scheduledFor);
  if (scheduled.getTime() < Date.now() + 5 * 60_000) {
    return NextResponse.json({ error: 'Date trop proche' }, { status: 400 });
  }
  if (scheduled.getTime() > Date.now() + 90 * 24 * 60 * 60_000) {
    return NextResponse.json({ error: 'Date trop éloignée' }, { status: 400 });
  }

  // No double booking with same phone within 1h slot
  const slotStart = new Date(scheduled.getTime() - 30 * 60_000);
  const slotEnd = new Date(scheduled.getTime() + 30 * 60_000);
  const dup = await prisma.ticket.findFirst({
    where: {
      branchId: branch.id,
      customerPhone: parsed.data.customerPhone,
      kind: 'appointment',
      scheduledFor: { gte: slotStart, lte: slotEnd },
      status: { in: ['waiting', 'called', 'in_progress'] },
    },
  });
  if (dup) {
    return NextResponse.json({ ok: true, publicCode: dup.publicCode, duplicate: true });
  }

  let serviceId: string | null = null;
  if (parsed.data.serviceId) {
    const v = branch.services.find((s) => s.id === parsed.data.serviceId);
    if (v) serviceId = v.id;
  }

  // Customer fidelity
  let customerId: string | null = null;
  const customer = await prisma.customer.upsert({
    where: { branchId_phone: { branchId: branch.id, phone: parsed.data.customerPhone } },
    update: { name: parsed.data.customerName.trim() },
    create: {
      branchId: branch.id,
      phone: parsed.data.customerPhone,
      name: parsed.data.customerName.trim(),
    },
  });
  customerId = customer.id;

  const cancelToken = crypto.randomBytes(16).toString('hex');
  // Les RDV démarrent en 'scheduled' : ils restent hors de la file active jusqu'à leur heure.
  // autoEnqueueAppointments (appelé dans buildSnapshot) les promeut en 'waiting' à échéance.
  const ticket = await prisma.ticket.create({
    data: {
      branchId: branch.id,
      number: 0, // attribué lors de la promotion en 'waiting'
      customerName: parsed.data.customerName.trim(),
      customerPhone: parsed.data.customerPhone,
      customerId,
      serviceId,
      kind: 'appointment',
      scheduledFor: scheduled,
      status: 'scheduled',
      cancelToken,
    },
  });

  await publishBranchUpdate(branch.id);
  return NextResponse.json({ ok: true, publicCode: ticket.publicCode, scheduledFor: scheduled.toISOString() });
}

// GET available slots (basic: 15-min slots within next 7 days, capped by simple capacity)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qrToken = url.searchParams.get('qrToken');
  const dateStr = url.searchParams.get('date'); // yyyy-mm-dd
  if (!qrToken || !dateStr) return NextResponse.json({ slots: [] });
  const branch = await prisma.branch.findUnique({
    where: { qrToken },
    include: { employees: true },
  });
  if (!branch || !branch.allowBooking) return NextResponse.json({ slots: [] });

  const day = new Date(dateStr + 'T00:00:00');
  const slotMin = branch.bookingSlotMin ?? 15;
  const slots: { time: string; available: boolean }[] = [];

  // Default open hours: 9:00 - 19:00
  let openHour = 9;
  let closeHour = 19;
  try {
    if (branch.openHours) {
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const oh = JSON.parse(branch.openHours) as Record<string, { open?: string; close?: string }>;
      const dayKey = days[day.getDay()];
      if (oh[dayKey]?.open) openHour = parseInt(oh[dayKey].open!.split(':')[0], 10);
      if (oh[dayKey]?.close) closeHour = parseInt(oh[dayKey].close!.split(':')[0], 10);
    }
  } catch {
    /* ignore */
  }

  const employees = Math.max(1, branch.employees.filter((e) => e.active).length);

  // Existing bookings that day
  const dayStart = new Date(day);
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const existing = await prisma.ticket.findMany({
    where: {
      branchId: branch.id,
      kind: 'appointment',
      scheduledFor: { gte: dayStart, lt: dayEnd },
      status: { in: ['waiting', 'called', 'in_progress'] },
    },
    select: { scheduledFor: true },
  });
  const counts = new Map<string, number>();
  existing.forEach((t) => {
    if (!t.scheduledFor) return;
    const k = t.scheduledFor.toISOString();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });

  for (let h = openHour; h < closeHour; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      const slot = new Date(day);
      slot.setHours(h, m, 0, 0);
      if (slot.getTime() < Date.now() + 30 * 60_000) continue;
      const taken = counts.get(slot.toISOString()) ?? 0;
      slots.push({
        time: slot.toISOString(),
        available: taken < employees,
      });
    }
  }
  return NextResponse.json({ slots });
}
