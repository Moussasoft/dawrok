import { prisma } from './db';
import { bus, channels } from './events';

export const ACTIVE_STATUSES = ['waiting', 'called', 'in_progress'] as const;

export async function getTodayTickets(branchId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return prisma.ticket.findMany({
    where: {
      branchId,
      status: { not: 'scheduled' }, // les RDV futurs restent hors de la file
      OR: [
        { createdAt: { gte: startOfDay } },                                          // walk-ins du jour
        { kind: 'appointment', scheduledFor: { gte: startOfDay, lt: endOfDay } },   // RDV programmés auj. (quelle que soit leur date de création)
      ],
    },
    include: { service: true, employee: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function getActiveQueue(branchId: string) {
  const tickets = await getTodayTickets(branchId);
  return tickets.filter((t) => ACTIVE_STATUSES.includes(t.status as (typeof ACTIVE_STATUSES)[number]));
}

/**
 * Compute estimated wait (minutes) for each waiting ticket, based on:
 * - in_progress / called tickets ahead → remaining of their avg duration
 * - waiting tickets ahead → full avg duration
 * - parallelized by number of active employees (default 1)
 *
 * Uses a min-heap-style allocation: each new waiting ticket goes to the
 * employee that becomes free the soonest.
 */
export async function computeETAs(branchId: string) {
  const [active, employees] = await Promise.all([
    getActiveQueue(branchId),
    prisma.employee.count({ where: { branchId, active: true } }),
  ]);
  const parallel = Math.max(1, employees);
  const now = Date.now();

  // Initialize "free at" timestamps for each employee slot.
  const slots: number[] = new Array(parallel).fill(0);
  // Pre-fill slots with currently in_progress / called tickets.
  const ongoing = active.filter((t) => t.status === 'called' || t.status === 'in_progress');
  for (let i = 0; i < ongoing.length && i < parallel; i++) {
    const t = ongoing[i];
    const dur = t.service?.avgDurationMin ?? 20;
    const startedAt = t.startedAt?.getTime() ?? t.calledAt?.getTime() ?? now;
    const elapsedMin = Math.max(0, (now - startedAt) / 60000);
    const remaining = Math.max(2, dur - elapsedMin);
    slots[i] = remaining;
  }
  // If more ongoing than slots, queue them as immediate.
  // (rare: shouldn't have more in-progress than employees)

  const results = active.map((t) => {
    const dur = t.service?.avgDurationMin ?? 20;
    if (t.status === 'waiting') {
      // pick slot that frees soonest
      let minIdx = 0;
      for (let i = 1; i < slots.length; i++) if (slots[i] < slots[minIdx]) minIdx = i;
      const eta = slots[minIdx];
      slots[minIdx] = eta + dur;
      return { ticketId: t.id, publicCode: t.publicCode, etaMin: Math.max(0, Math.round(eta)) };
    }
    return { ticketId: t.id, publicCode: t.publicCode, etaMin: 0 };
  });
  return results;
}

/**
 * Promeut les rendez-vous dont l'heure est arrivée : scheduled → waiting.
 * Appelé automatiquement dans buildSnapshot (max toutes les 30 s via SSE refresh).
 */
export async function autoEnqueueAppointments(branchId: string): Promise<void> {
  const now = new Date();
  const due = await prisma.ticket.findMany({
    where: { branchId, kind: 'appointment', status: 'scheduled', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
    select: { id: true },
  });
  for (const { id } of due) {
    const number = await getNextTicketNumber(branchId);
    // updateMany avec filtre sur status pour éviter la double-promotion en cas de concurrence
    await prisma.ticket.updateMany({
      where: { id, status: 'scheduled' },
      data: { status: 'waiting', number },
    });
  }
}

export type QueueSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;

export async function buildSnapshot(branchId: string) {
  await autoEnqueueAppointments(branchId); // promeut les RDV dus avant de construire le snapshot
  const [tickets, etas, branch] = await Promise.all([
    getActiveQueue(branchId),
    computeETAs(branchId),
    prisma.branch.findUnique({ where: { id: branchId }, include: { organization: true } }),
  ]);
  const etaByCode = new Map(etas.map((e) => [e.publicCode, e.etaMin]));
  return {
    branchId,
    branchName: branch?.name ?? '',
    orgName: branch?.organization.name ?? '',
    brandColor: branch?.organization.brandColor ?? '#6366F1',
    logoUrl: branch?.organization.logoUrl ?? null,
    closedUntil: branch?.closedUntil ? branch.closedUntil.toISOString() : null,
    closureReason: branch?.closureReason ?? null,
    isPaused:
      !!branch?.closedUntil && branch.closedUntil.getTime() > Date.now(),
    updatedAt: new Date().toISOString(),
    tickets: tickets.map((t, i) => ({
      id: t.id,
      publicCode: t.publicCode,
      number: t.number,
      customerName: t.customerName,
      status: t.status,
      serviceName: t.service?.name ?? null,
      employeeName: t.employee?.name ?? null,
      position: t.status === 'waiting' ? i : 0,
      etaMin: etaByCode.get(t.publicCode) ?? 0,
      createdAt: t.createdAt.toISOString(),
      calledAt: t.calledAt?.toISOString() ?? null,
    })),
  };
}

export async function publishBranchUpdate(branchId: string) {
  const snapshot = await buildSnapshot(branchId);
  bus.publish(channels.branch(branchId), snapshot);
  // Per-ticket events for finer fan-out
  for (const t of snapshot.tickets) {
    bus.publish(channels.ticket(t.publicCode), {
      ticket: t,
      branchName: snapshot.branchName,
      orgName: snapshot.orgName,
      logoUrl: snapshot.logoUrl,
      closedUntil: snapshot.closedUntil,
      closureReason: snapshot.closureReason,
      isPaused: snapshot.isPaused,
      totalAhead: snapshot.tickets.filter((x) => x.status !== 'in_progress' && x.position < t.position).length,
      nowServing: snapshot.tickets.filter((x) => x.status === 'in_progress' || x.status === 'called').length,
      brandColor: snapshot.brandColor,
    });
  }
}

export async function getNextTicketNumber(branchId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const last = await prisma.ticket.findFirst({
    where: {
      branchId,
      status: { not: 'scheduled' }, // les tickets scheduled ont number=0, on les ignore
      OR: [
        { createdAt: { gte: startOfDay } },
        { kind: 'appointment', scheduledFor: { gte: startOfDay, lt: endOfDay } },
      ],
    },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}
