// Logique de file pure (sans base de données) : ordre, estimation d'attente,
// statistiques et projections publiques. Couverte par les tests unitaires.
import type {
  DashboardSnapshot,
  DayStats,
  PublicSnapshot,
  QueueTicket,
  TicketView,
} from './queue-types';

export const DEFAULT_SERVICE_MIN = 20;

type OrderableTicket = {
  status: string;
  priority: number;
  kind: string;
  createdAt: Date;
  scheduledFor: Date | null;
  calledAt: Date | null;
};

/** Heure d'arrivée effective : l'heure du RDV pour un rendez-vous, sinon la prise du ticket. */
export function effectiveTime(t: Pick<OrderableTicket, 'kind' | 'createdAt' | 'scheduledFor'>): number {
  return t.kind === 'appointment' && t.scheduledFor ? t.scheduledFor.getTime() : t.createdAt.getTime();
}

/**
 * Ordre de la file : d'abord les clients en cours de service (par heure d'appel),
 * puis les tickets en attente par priorité décroissante et heure d'arrivée croissante.
 */
export function sortQueue<T extends OrderableTicket>(tickets: T[]): T[] {
  const ongoing = tickets
    .filter((t) => t.status === 'called' || t.status === 'in_progress')
    .sort((a, b) => (a.calledAt?.getTime() ?? 0) - (b.calledAt?.getTime() ?? 0));
  const waiting = tickets
    .filter((t) => t.status === 'waiting')
    .sort((a, b) => b.priority - a.priority || effectiveTime(a) - effectiveTime(b));
  return [...ongoing, ...waiting];
}

type EtaTicket = {
  id: string;
  status: string;
  durationMin: number | null;
  calledAt: Date | null;
  startedAt: Date | null;
};

/**
 * Attente estimée (minutes) de chaque ticket, pour une file déjà triée.
 * Chaque employé actif est un « guichet » ; un ticket part au guichet libéré le plus tôt.
 * Les clients en cours occupent d'abord les guichets pour leur durée restante.
 */
export function computeEtas(sorted: EtaTicket[], activeEmployees: number, now: number): Map<string, number> {
  const slots: number[] = new Array(Math.max(1, activeEmployees)).fill(0);
  const pickSlot = () => {
    let idx = 0;
    for (let i = 1; i < slots.length; i++) if (slots[i] < slots[idx]) idx = i;
    return idx;
  };
  const etas = new Map<string, number>();

  for (const t of sorted) {
    const dur = t.durationMin ?? DEFAULT_SERVICE_MIN;
    if (t.status === 'called' || t.status === 'in_progress') {
      const since = t.startedAt?.getTime() ?? t.calledAt?.getTime() ?? now;
      const elapsed = Math.max(0, (now - since) / 60000);
      const idx = pickSlot();
      slots[idx] += Math.max(2, dur - elapsed);
      etas.set(t.id, 0);
    }
  }
  for (const t of sorted) {
    if (t.status !== 'waiting') continue;
    const idx = pickSlot();
    etas.set(t.id, Math.max(0, Math.round(slots[idx])));
    slots[idx] += t.durationMin ?? DEFAULT_SERVICE_MIN;
  }
  return etas;
}

type StatTicket = {
  status: string;
  kind: string;
  createdAt: Date;
  scheduledFor: Date | null;
  calledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export function computeDayStats(tickets: StatTicket[]): DayStats {
  const waits: number[] = [];
  const services: number[] = [];
  let done = 0;
  let noShow = 0;
  let cancelled = 0;
  for (const t of tickets) {
    if (t.status === 'done') done++;
    else if (t.status === 'no_show') noShow++;
    else if (t.status === 'cancelled') cancelled++;
    if (t.calledAt) waits.push(Math.max(0, (t.calledAt.getTime() - effectiveTime(t)) / 60000));
    if (t.status === 'done' && t.startedAt && t.completedAt) {
      services.push(Math.max(0, (t.completedAt.getTime() - t.startedAt.getTime()) / 60000));
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    total: tickets.length,
    done,
    noShow,
    cancelled,
    avgWaitMin: Math.round(avg(waits)),
    avgServiceMin: Math.round(avg(services)),
  };
}

/** Projection anonymisée de l'instantané (écran TV, page publique). */
export function toPublicSnapshot(snap: DashboardSnapshot): PublicSnapshot {
  const { branchId: _branchId, tickets, stats: _stats, activeEmployees: _e, ...info } = snap;
  return {
    ...info,
    waitingCount: tickets.filter((t) => t.status === 'waiting').length,
    servingCount: tickets.filter((t) => t.status !== 'waiting').length,
    tickets: tickets.map((t) => ({
      number: t.number,
      status: t.status,
      serviceName: t.serviceName,
      employeeName: t.employeeName,
      position: t.position,
      etaMin: t.etaMin,
      calledAt: t.calledAt,
      recallCount: t.recallCount,
    })),
  };
}

export function branchInfoOf(snap: DashboardSnapshot): TicketView['branch'] {
  const { branchId: _b, tickets: _t, stats: _s, activeEmployees: _e, updatedAt: _u, ...info } = snap;
  return info;
}

/** Vue « détenteur » d'un ticket actif, ou null s'il n'est pas dans la file active. */
export function toActiveTicketView(
  snap: DashboardSnapshot,
  publicCode: string,
  cancelToken: string | null
): TicketView | null {
  const t: QueueTicket | undefined = snap.tickets.find((x) => x.publicCode === publicCode);
  if (!t) return null;
  return {
    updatedAt: snap.updatedAt,
    branch: branchInfoOf(snap),
    ticket: {
      number: t.number,
      status: t.status,
      kind: t.kind,
      customerName: t.customerName,
      serviceName: t.serviceName,
      employeeName: t.employeeName,
      peopleAhead: Math.max(0, t.position),
      etaMin: t.etaMin,
      scheduledFor: t.scheduledFor,
      calledAt: t.calledAt,
      recallCount: t.recallCount,
    },
    nowServing: snap.tickets.filter((x) => x.status !== 'waiting').length,
    cancelToken: t.status === 'in_progress' ? null : cancelToken,
  };
}

export type PushKind = 'called' | 'soon' | 'appointment';

/** Au-delà, un ticket « appelé » absent de l'instantané précédent est un retour arrière, pas un appel. */
const FRESH_CALL_MS = 60_000;

/**
 * Transitions qui méritent une notification entre deux instantanés successifs.
 * Sans instantané précédent (redémarrage), on ne notifie rien pour éviter les doublons.
 */
export function detectTransitions(
  prev: DashboardSnapshot | undefined,
  next: DashboardSnapshot,
  soonThreshold = 2,
  now = Date.now()
): { ticketId: string; kind: PushKind }[] {
  if (!prev) return [];
  const before = new Map(prev.tickets.map((t) => [t.id, t]));
  const out: { ticketId: string; kind: PushKind }[] = [];
  for (const t of next.tickets) {
    const b = before.get(t.id);
    if (t.status === 'called') {
      // Un nouvel appel change calledAt, un rappel change recallCount. Annuler « Démarrer »
      // ou « Terminé » ramène à « appelé » sans rien changer : pas de nouvelle notification.
      const calledAt = t.calledAt ? Date.parse(t.calledAt) : 0;
      const isNewCall = b ? b.calledAt !== t.calledAt || b.recallCount !== t.recallCount : now - calledAt < FRESH_CALL_MS;
      if (isNewCall) out.push({ ticketId: t.id, kind: 'called' });
    } else if (t.status === 'waiting') {
      if (!b && t.kind === 'appointment') out.push({ ticketId: t.id, kind: 'appointment' });
      else if (b && b.status === 'waiting' && b.position > soonThreshold && t.position <= soonThreshold) {
        out.push({ ticketId: t.id, kind: 'soon' });
      }
    }
  }
  return out;
}
