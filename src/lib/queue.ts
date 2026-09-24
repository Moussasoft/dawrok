import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { bus, channels } from './events';
import {
  computeDayStats,
  computeEtas,
  detectTransitions,
  sortQueue,
  toActiveTicketView,
  branchInfoOf,
} from './queue-logic';
import type { DashboardSnapshot, QueueTicket, TicketView } from './queue-types';
import { DEFAULT_TIMEZONE, getDayWindow } from './time';
import { isOpenAt, nextOpening, parseOpenHours } from './opening-hours';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from './ticket-status';
import { isFeedbackOpen } from './feedback';

export { ACTIVE_STATUSES };

// ─── Numérotation ────────────────────────────────────────────────────────────

const RETRYABLE_CODES = new Set(['P2002', 'P2034', 'P1008']);

function isRetryable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_CODES.has(e.code)) return true;
  const msg = e instanceof Error ? e.message : '';
  return /database is locked|SQLITE_BUSY|write conflict|deadlock/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e;
      await new Promise((r) => setTimeout(r, 15 * (i + 1) + Math.random() * 40));
    }
  }
  throw lastError;
}

function todayWhere(branchId: string, start: Date, end: Date): Prisma.TicketWhereInput {
  return {
    branchId,
    status: { not: 'scheduled' },
    OR: [
      { createdAt: { gte: start, lt: end } },
      { kind: 'appointment', scheduledFor: { gte: start, lt: end } },
    ],
  };
}

/**
 * Prochain numéro du jour (jour local de l'agence), attribué atomiquement par une seule
 * requête `UPDATE … RETURNING` (SQLite ≥ 3.35 et PostgreSQL) : pas de transaction longue,
 * donc pas de contention de verrou, et jamais deux clients avec le même numéro.
 */
export async function nextTicketNumber(branchId: string, timeZone: string, now = new Date()): Promise<number> {
  const { key: day, start, end } = getDayWindow(now, timeZone);
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await withRetry(
      () => prisma.$queryRaw<{ value: number | bigint }[]>`
        UPDATE "DailyCounter" SET "value" = "value" + 1
        WHERE "branchId" = ${branchId} AND "day" = ${day}
        RETURNING "value"`
    );
    if (rows.length) return Number(rows[0].value);
    // Premier ticket du jour : on initialise à partir du plus grand numéro existant
    // (données antérieures au compteur), puis on recommence l'incrément atomique.
    const last = await prisma.ticket.findFirst({
      where: todayWhere(branchId, start, end),
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    await withRetry(
      () => prisma.$executeRaw`
        INSERT INTO "DailyCounter" ("branchId", "day", "value")
        VALUES (${branchId}, ${day}, ${last?.number ?? 0})
        ON CONFLICT ("branchId", "day") DO NOTHING`
    );
  }
  throw new Error(`Compteur de tickets indisponible (${branchId}, ${day})`);
}

// ─── Maintenance de la file ──────────────────────────────────────────────────

const MAINTENANCE_INTERVAL_MS = 60_000;
const lastMaintenance = new Map<string, number>();

/**
 * - promeut les RDV arrivés à échéance (scheduled → waiting, en tête de file) ;
 * - clôt les tickets actifs des jours précédents (restés « en attente » à vie sinon) ;
 * - purge les abonnements push des tickets terminés.
 */
export async function maintainQueue(branchId: string, timeZone: string, now = new Date(), force = false): Promise<void> {
  // Au plus une fois par minute et par agence : ces écritures verrouillent la base (SQLite).
  const last = lastMaintenance.get(branchId) ?? 0;
  if (!force && now.getTime() - last < MAINTENANCE_INTERVAL_MS) return;
  lastMaintenance.set(branchId, now.getTime());

  const { start } = getDayWindow(now, timeZone);

  // Lecture d'abord, écriture seulement si nécessaire.
  const due = await prisma.ticket.findMany({
    where: { branchId, kind: 'appointment', status: 'scheduled', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
    select: { id: true, scheduledFor: true },
  });
  for (const t of due) {
    if (t.scheduledFor && t.scheduledFor < start) {
      // RDV d'un jour passé jamais activé : on le classe sans pénaliser le client.
      await prisma.ticket.updateMany({
        where: { id: t.id, status: 'scheduled' },
        data: { status: 'cancelled', completedAt: now },
      });
      continue;
    }
    const number = await nextTicketNumber(branchId, timeZone, now);
    await prisma.ticket.updateMany({
      where: { id: t.id, status: 'scheduled' },
      data: { status: 'waiting', number, priority: 1 },
    });
  }

  const staleWhere = {
    branchId,
    status: { in: [...ACTIVE_STATUSES] },
    createdAt: { lt: start },
    OR: [{ scheduledFor: null }, { scheduledFor: { lt: start } }],
  };
  if (await prisma.ticket.findFirst({ where: staleWhere, select: { id: true } })) {
    await prisma.ticket.updateMany({ where: staleWhere, data: { status: 'cancelled', completedAt: now } });
  }

  const orphanSubs = { ticket: { branchId, status: { in: [...TERMINAL_STATUSES] } } };
  if (await prisma.pushSubscription.findFirst({ where: orphanSubs, select: { id: true } })) {
    await prisma.pushSubscription.deleteMany({ where: orphanSubs });
  }
}

// ─── Instantané ──────────────────────────────────────────────────────────────

export async function buildSnapshot(branchId: string): Promise<DashboardSnapshot> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, include: { organization: true } });
  if (!branch) throw new Error(`Agence introuvable : ${branchId}`);
  const timeZone = branch.timezone || DEFAULT_TIMEZONE;
  const now = new Date();

  await maintainQueue(branchId, timeZone, now);

  const { start, end } = getDayWindow(now, timeZone);
  const [todays, activeEmployees] = await Promise.all([
    prisma.ticket.findMany({ where: todayWhere(branchId, start, end), include: { service: true, employee: true } }),
    prisma.employee.count({ where: { branchId, active: true } }),
  ]);

  const active = sortQueue(todays.filter((t) => (ACTIVE_STATUSES as readonly string[]).includes(t.status)));
  const etas = computeEtas(
    active.map((t) => ({
      id: t.id,
      status: t.status,
      durationMin: t.service?.avgDurationMin ?? null,
      calledAt: t.calledAt,
      startedAt: t.startedAt,
    })),
    activeEmployees,
    now.getTime()
  );

  let rank = 0;
  const tickets: QueueTicket[] = active.map((t) => ({
    id: t.id,
    publicCode: t.publicCode,
    number: t.number,
    customerName: t.customerName,
    customerPhone: t.customerPhone,
    status: t.status as QueueTicket['status'],
    kind: t.kind,
    priority: t.priority,
    serviceId: t.serviceId,
    serviceName: t.service?.name ?? null,
    serviceColor: t.service?.color ?? null,
    employeeId: t.employeeId,
    employeeName: t.employee?.name ?? null,
    position: t.status === 'waiting' ? rank++ : -1,
    etaMin: etas.get(t.id) ?? 0,
    createdAt: t.createdAt.toISOString(),
    calledAt: t.calledAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    scheduledFor: t.scheduledFor?.toISOString() ?? null,
    recallCount: t.recallCount,
  }));

  const hours = parseOpenHours(branch.openHours);
  return {
    branchId,
    branchName: branch.name,
    orgName: branch.organization.name,
    brandColor: branch.organization.brandColor,
    logoUrl: branch.organization.logoUrl,
    timezone: timeZone,
    closedUntil: branch.closedUntil?.toISOString() ?? null,
    closureReason: branch.closureReason,
    isPaused: !!branch.closedUntil && branch.closedUntil.getTime() > now.getTime(),
    isOpenNow: isOpenAt(hours, timeZone, now),
    nextOpening: nextOpening(hours, timeZone, now),
    updatedAt: now.toISOString(),
    activeEmployees,
    tickets,
    stats: computeDayStats(todays),
  };
}

// ─── Hub temps réel ──────────────────────────────────────────────────────────
// Un seul instantané par agence, partagé par toutes les connexions SSE (au lieu d'une
// reconstruction par client), rafraîchi toutes les 30 s tant que quelqu'un écoute.
// En mémoire : pour plusieurs instances, remplacer le bus par Redis pub/sub.

type Listener = (snap: DashboardSnapshot) => void;
const REFRESH_MS = 30_000;
const FRESH_MS = 10_000;

class QueueHub {
  private snapshots = new Map<string, DashboardSnapshot>();
  private inflight = new Map<string, Promise<DashboardSnapshot>>();
  private queued = new Map<string, Promise<DashboardSnapshot>>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private listenerCount = new Map<string, number>();

  async get(branchId: string): Promise<DashboardSnapshot> {
    const cached = this.snapshots.get(branchId);
    if (cached && Date.now() - Date.parse(cached.updatedAt) < FRESH_MS) return cached;
    return this.inflight.get(branchId) ?? this.run(branchId);
  }

  /** Reconstruit et diffuse. Une reconstruction en cours est suivie d'une seule autre. */
  refresh(branchId: string): Promise<DashboardSnapshot> {
    const running = this.inflight.get(branchId);
    if (!running) return this.run(branchId);
    let next = this.queued.get(branchId);
    if (!next) {
      next = running
        .catch(() => undefined)
        .then(() => {
          this.queued.delete(branchId);
          return this.run(branchId);
        });
      this.queued.set(branchId, next);
    }
    return next;
  }

  private async run(branchId: string): Promise<DashboardSnapshot> {
    const task = (async () => {
      const prev = this.snapshots.get(branchId);
      const snap = await buildSnapshot(branchId);
      this.snapshots.set(branchId, snap);
      bus.publish(channels.branch(branchId), snap);
      const transitions = detectTransitions(prev, snap);
      if (transitions.length) {
        import('./push')
          .then((m) => m.notifyTransitions(snap, transitions))
          .catch((e) => console.error('[push] échec', e));
      }
      return snap;
    })();
    this.inflight.set(branchId, task);
    try {
      return await task;
    } finally {
      if (this.inflight.get(branchId) === task) this.inflight.delete(branchId);
    }
  }

  subscribe(branchId: string, listener: Listener): () => void {
    const unsub = bus.subscribe(channels.branch(branchId), (data) => listener(data as DashboardSnapshot));
    this.listenerCount.set(branchId, (this.listenerCount.get(branchId) ?? 0) + 1);
    if (!this.timers.has(branchId)) {
      const timer = setInterval(() => {
        this.refresh(branchId).catch((e) => console.error('[queue] rafraîchissement échoué', e));
      }, REFRESH_MS);
      this.timers.set(branchId, timer);
    }
    return () => {
      unsub();
      const left = (this.listenerCount.get(branchId) ?? 1) - 1;
      if (left > 0) {
        this.listenerCount.set(branchId, left);
        return;
      }
      this.listenerCount.delete(branchId);
      const timer = this.timers.get(branchId);
      if (timer) clearInterval(timer);
      this.timers.delete(branchId);
    };
  }
}

const globalForHub = globalThis as unknown as { __queueHub?: QueueHub };
export const queueHub: QueueHub = globalForHub.__queueHub ?? (globalForHub.__queueHub = new QueueHub());

export function getSnapshot(branchId: string) {
  return queueHub.get(branchId);
}

/**
 * Suit une agence pour un flux SSE : abonnement AVANT l'envoi de l'état initial (aucune
 * mise à jour perdue entre les deux), livraisons sérialisées et jamais plus anciennes que
 * la dernière envoyée (un instantané en cache ne peut pas écraser une mise à jour récente).
 */
export async function followBranch(
  branchId: string,
  handler: (snap: DashboardSnapshot) => void | Promise<void>
): Promise<() => void> {
  let lastAt = 0;
  let chain: Promise<void> = Promise.resolve();
  const deliver = (snap: DashboardSnapshot) => {
    chain = chain
      .then(async () => {
        const at = Date.parse(snap.updatedAt);
        if (at < lastAt) return;
        lastAt = at;
        await handler(snap);
      })
      .catch((e) => console.error('[sse] diffusion échouée', e));
  };
  const unsubscribe = queueHub.subscribe(branchId, deliver);
  deliver(await getSnapshot(branchId));
  return unsubscribe;
}

/** À appeler après toute modification de la file. Ne lève jamais : le temps réel ne doit pas casser l'API. */
export async function publishBranchUpdate(branchId: string): Promise<void> {
  try {
    await queueHub.refresh(branchId);
  } catch (e) {
    console.error('[queue] diffusion échouée', e);
  }
}

/**
 * Vue d'un ticket pour son détenteur, active ou non (RDV à venir, terminé, annulé).
 */
export async function getTicketView(
  snap: DashboardSnapshot,
  ticket: { publicCode: string; cancelToken: string | null }
): Promise<TicketView | null> {
  const active = toActiveTicketView(snap, ticket.publicCode, ticket.cancelToken);
  if (active) return active;
  const raw = await prisma.ticket.findUnique({
    where: { publicCode: ticket.publicCode },
    include: { service: true, employee: true, feedback: { select: { rating: true } } },
  });
  if (!raw) return null;
  const rating = raw.feedback?.rating ?? null;
  return {
    updatedAt: snap.updatedAt,
    branch: branchInfoOf(snap),
    ticket: {
      number: raw.number,
      status: raw.status,
      kind: raw.kind,
      customerName: raw.customerName,
      serviceName: raw.service?.name ?? null,
      employeeName: raw.employee?.name ?? null,
      peopleAhead: 0,
      etaMin: 0,
      scheduledFor: raw.scheduledFor?.toISOString() ?? null,
      calledAt: raw.calledAt?.toISOString() ?? null,
      recallCount: raw.recallCount,
    },
    nowServing: snap.tickets.filter((x) => x.status !== 'waiting').length,
    cancelToken: raw.status === 'scheduled' ? raw.cancelToken : null,
    feedback: raw.status === 'done' ? { open: rating === null && isFeedbackOpen(raw), rating } : null,
  };
}
