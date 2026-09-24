import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVICE_MIN,
  computeDayStats,
  computeEtas,
  detectTransitions,
  effectiveTime,
  sortQueue,
  toActiveTicketView,
  toPublicSnapshot,
} from './queue-logic';
import type { DashboardSnapshot, QueueTicket } from './queue-types';

const at = (hm: string) => new Date(`2026-09-24T${hm}:00.000Z`);
const NOW = at('10:00').getTime();

// ─── Fabriques de données ────────────────────────────────────────────────────

type Orderable = {
  id: string;
  status: string;
  priority: number;
  kind: string;
  createdAt: Date;
  scheduledFor: Date | null;
  calledAt: Date | null;
};
const ord = (id: string, over: Partial<Orderable> = {}): Orderable => ({
  id,
  status: 'waiting',
  priority: 0,
  kind: 'walkin',
  createdAt: at('09:00'),
  scheduledFor: null,
  calledAt: null,
  ...over,
});

type EtaTicket = { id: string; status: string; durationMin: number | null; calledAt: Date | null; startedAt: Date | null };
const eta = (id: string, over: Partial<EtaTicket> = {}): EtaTicket => ({
  id,
  status: 'waiting',
  durationMin: 10,
  calledAt: null,
  startedAt: null,
  ...over,
});
const etas = (list: EtaTicket[], employees: number) => Object.fromEntries(computeEtas(list, employees, NOW));

type StatTicket = Parameters<typeof computeDayStats>[0][number];
const stat = (over: Partial<StatTicket>): StatTicket => ({
  status: 'waiting',
  kind: 'walkin',
  createdAt: at('09:00'),
  scheduledFor: null,
  calledAt: null,
  startedAt: null,
  completedAt: null,
  ...over,
});

function ticket(id: string, over: Partial<QueueTicket> = {}): QueueTicket {
  return {
    id,
    publicCode: `code-${id}`,
    number: 1,
    customerName: `Client ${id}`,
    customerPhone: null,
    status: 'waiting',
    kind: 'walkin',
    priority: 0,
    serviceId: 'svc-coupe',
    serviceName: 'Coupe',
    serviceColor: '#0ea5e9',
    employeeId: null,
    employeeName: null,
    position: 0,
    etaMin: 0,
    createdAt: '2026-09-24T09:00:00.000Z',
    calledAt: null,
    startedAt: null,
    scheduledFor: null,
    recallCount: 0,
    ...over,
  };
}

function snapshot(tickets: QueueTicket[]): DashboardSnapshot {
  return {
    branchId: 'branch-secret-id',
    branchName: 'Agence Maârif',
    orgName: 'Salon Atlas',
    brandColor: '#0ea5e9',
    logoUrl: null,
    timezone: 'Africa/Casablanca',
    closedUntil: null,
    closureReason: null,
    isPaused: false,
    isOpenNow: true,
    nextOpening: null,
    updatedAt: '2026-09-24T10:00:00.000Z',
    activeEmployees: 2,
    tickets,
    stats: { total: 9, done: 4, noShow: 1, cancelled: 1, avgWaitMin: 13, avgServiceMin: 21 },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('effectiveTime', () => {
  it('utilise l’heure du RDV pour un rendez-vous', () => {
    expect(effectiveTime({ kind: 'appointment', createdAt: at('07:00'), scheduledFor: at('09:30') })).toBe(at('09:30').getTime());
  });

  it('utilise l’heure de prise du ticket sinon', () => {
    expect(effectiveTime({ kind: 'walkin', createdAt: at('08:00'), scheduledFor: null })).toBe(at('08:00').getTime());
    expect(effectiveTime({ kind: 'walkin', createdAt: at('08:00'), scheduledFor: at('09:30') })).toBe(at('08:00').getTime());
    expect(effectiveTime({ kind: 'appointment', createdAt: at('08:00'), scheduledFor: null })).toBe(at('08:00').getTime());
  });
});

describe('sortQueue', () => {
  const tickets = [
    ord('A', { createdAt: at('09:00') }),
    ord('B', { createdAt: at('08:50') }),
    ord('C', { createdAt: at('09:10'), priority: 1 }),
    ord('D', { kind: 'appointment', createdAt: at('07:00'), scheduledFor: at('08:55') }),
    ord('E', { status: 'called', calledAt: at('09:05') }),
    ord('F', { status: 'in_progress', calledAt: at('09:01') }),
    ord('G', { status: 'done', calledAt: at('08:00') }),
  ];

  it('met les clients en cours d’abord (par appel), puis la file par priorité et heure effective', () => {
    // D a pris son ticket à 07:00 mais son RDV est à 08:55 : il passe après B (08:50).
    expect(sortQueue(tickets).map((t) => t.id)).toEqual(['F', 'E', 'C', 'B', 'D', 'A']);
  });

  it('écarte les tickets terminés sans modifier le tableau d’origine', () => {
    const before = [...tickets];
    expect(sortQueue(tickets).map((t) => t.id)).not.toContain('G');
    expect(tickets).toEqual(before);
  });
});

describe('computeEtas', () => {
  it('additionne les durées avec un seul employé', () => {
    const list = [eta('a', { durationMin: 10 }), eta('b', { durationMin: 20 }), eta('c', { durationMin: 15 }), eta('d')];
    expect(etas(list, 1)).toEqual({ a: 0, b: 10, c: 30, d: 45 });
  });

  it('répartit la file sur deux employés en parallèle', () => {
    const list = [eta('a', { durationMin: 10 }), eta('b', { durationMin: 20 }), eta('c', { durationMin: 30 }), eta('d', { durationMin: 5 })];
    expect(etas(list, 2)).toEqual({ a: 0, b: 0, c: 10, d: 20 });
  });

  it('utilise DEFAULT_SERVICE_MIN pour une durée inconnue', () => {
    expect(DEFAULT_SERVICE_MIN).toBe(20);
    expect(etas([eta('a', { durationMin: null }), eta('b')], 1)).toEqual({ a: 0, b: DEFAULT_SERVICE_MIN });
  });

  it('décompte le temps restant d’un client en cours', () => {
    const serving = eta('s', { status: 'in_progress', durationMin: 30, calledAt: at('09:45'), startedAt: at('09:50') });
    expect(etas([serving, eta('a')], 1)).toEqual({ s: 0, a: 20 }); // 10 min écoulées sur 30
  });

  it('part de l’appel si le service n’a pas commencé', () => {
    const called = eta('c', { status: 'called', durationMin: null, calledAt: at('09:55') });
    expect(etas([called, eta('a')], 1)).toEqual({ c: 0, a: 15 }); // 20 − 5
  });

  it('réserve au moins 2 minutes à un service qui déborde', () => {
    const late = eta('s', { status: 'in_progress', durationMin: 30, calledAt: at('09:00'), startedAt: at('09:10') });
    expect(etas([late, eta('a')], 1)).toEqual({ s: 0, a: 2 });
  });

  it('envoie le suivant au guichet libéré le plus tôt', () => {
    const s1 = eta('s1', { status: 'in_progress', durationMin: 30, calledAt: at('09:50'), startedAt: at('09:50') }); // reste 20
    const s2 = eta('s2', { status: 'in_progress', durationMin: 10, calledAt: at('09:55'), startedAt: at('09:55') }); // reste 5
    expect(etas([s1, s2, eta('a', { durationMin: 10 }), eta('b')], 2)).toEqual({ s1: 0, s2: 0, a: 5, b: 15 });
  });

  it('traite 0 employé actif comme 1', () => {
    expect(etas([eta('a'), eta('b')], 0)).toEqual({ a: 0, b: 10 });
  });
});

describe('computeDayStats', () => {
  it('compte les statuts et calcule attente et durée de service moyennes', () => {
    const stats = computeDayStats([
      // attente 10, service 20
      stat({ status: 'done', createdAt: at('09:00'), calledAt: at('09:10'), startedAt: at('09:12'), completedAt: at('09:32') }),
      // attente 20, pas de service
      stat({ status: 'no_show', createdAt: at('09:05'), calledAt: at('09:25'), completedAt: at('09:30') }),
      stat({ status: 'cancelled', createdAt: at('09:20'), completedAt: at('09:21') }),
      // RDV : attente comptée depuis l'heure du RDV (5), service 10
      stat({
        status: 'done',
        kind: 'appointment',
        createdAt: at('08:00'),
        scheduledFor: at('10:00'),
        calledAt: at('10:05'),
        startedAt: at('10:05'),
        completedAt: at('10:15'),
      }),
      stat({ status: 'waiting', createdAt: at('10:20') }),
    ]);
    expect(stats).toEqual({ total: 5, done: 2, noShow: 1, cancelled: 1, avgWaitMin: 12, avgServiceMin: 15 });
  });

  it('ne compte pas d’attente négative pour un RDV appelé en avance', () => {
    const stats = computeDayStats([stat({ status: 'called', kind: 'appointment', scheduledFor: at('10:00'), calledAt: at('09:50') })]);
    expect(stats.avgWaitMin).toBe(0);
  });

  it('renvoie des zéros pour une journée vide', () => {
    expect(computeDayStats([])).toEqual({ total: 0, done: 0, noShow: 0, cancelled: 0, avgWaitMin: 0, avgServiceMin: 0 });
  });
});

describe('toPublicSnapshot', () => {
  const snap = snapshot([
    ticket('ticket-secret-1', {
      publicCode: 'PUB-SECRET-1',
      number: 12,
      customerName: 'Fatima Zahra',
      customerPhone: '+212600000001',
      status: 'in_progress',
      position: -1,
      employeeId: 'emp-secret-1',
      employeeName: 'Poste 1',
      calledAt: '2026-09-24T09:50:00.000Z',
      startedAt: '2026-09-24T09:51:00.000Z',
    }),
    ticket('ticket-secret-2', {
      publicCode: 'PUB-SECRET-2',
      number: 13,
      customerName: 'Youssef Alaoui',
      customerPhone: '+212600000002',
      position: 0,
      etaMin: 8,
    }),
    ticket('ticket-secret-3', {
      publicCode: 'PUB-SECRET-3',
      number: 14,
      customerName: 'Salma Idrissi',
      kind: 'appointment',
      scheduledFor: '2026-09-24T10:15:00.000Z',
      position: 1,
      etaMin: 25,
    }),
  ]);
  const pub = toPublicSnapshot(snap);

  it('ne divulgue ni nom, ni téléphone, ni code, ni identifiant, ni statistiques', () => {
    const json = JSON.stringify(pub);
    const keys = new Set<string>();
    JSON.parse(json, (key, value) => {
      keys.add(key);
      return value;
    });
    const forbiddenKeys = ['customerName', 'customerPhone', 'publicCode', 'id', 'branchId', 'stats', 'activeEmployees', 'employeeId', 'serviceId'];
    for (const key of forbiddenKeys) expect(keys.has(key), `clé « ${key} » exposée`).toBe(false);
    const secrets = ['Fatima', 'Youssef', 'Salma', '+2126', 'PUB-SECRET', 'ticket-secret', 'branch-secret', 'emp-secret'];
    for (const value of secrets) expect(json, `valeur « ${value} » exposée`).not.toContain(value);
  });

  it('ne garde que les champs publics de chaque ticket (liste blanche)', () => {
    for (const t of pub.tickets) {
      expect(Object.keys(t).sort()).toEqual(['calledAt', 'employeeName', 'etaMin', 'number', 'position', 'recallCount', 'serviceName', 'status']);
    }
  });

  it('expose uniquement les infos d’agence et les compteurs attendus (liste blanche)', () => {
    expect(Object.keys(pub).sort()).toEqual([
      'branchName',
      'brandColor',
      'closedUntil',
      'closureReason',
      'isOpenNow',
      'isPaused',
      'logoUrl',
      'nextOpening',
      'orgName',
      'servingCount',
      'tickets',
      'timezone',
      'updatedAt',
      'waitingCount',
    ]);
  });

  it('conserve l’ordre, les numéros et compte attente / service', () => {
    expect(pub).toMatchObject({ branchName: 'Agence Maârif', updatedAt: snap.updatedAt, waitingCount: 2, servingCount: 1 });
    expect(pub.tickets.map((t) => t.number)).toEqual([12, 13, 14]);
    expect(pub.tickets[1]).toEqual({
      number: 13,
      status: 'waiting',
      serviceName: 'Coupe',
      employeeName: null,
      position: 0,
      etaMin: 8,
      calledAt: null,
      recallCount: 0,
    });
  });
});

describe('toActiveTicketView', () => {
  const snap = snapshot([
    ticket('t1', { publicCode: 'AAA', status: 'in_progress', position: -1, customerName: 'Karim', customerPhone: '+212611111111' }),
    ticket('t2', { publicCode: 'BBB', status: 'called', position: -1, customerName: 'Imane' }),
    ticket('t3', { publicCode: 'CCC', position: 0, etaMin: 5, customerName: 'Omar' }),
    ticket('t4', {
      publicCode: 'DDD',
      position: 1,
      etaMin: 15,
      customerName: 'Nadia',
      kind: 'appointment',
      scheduledFor: '2026-09-24T10:30:00.000Z',
    }),
  ]);

  it('donne au détenteur sa position (personnes devant) et son jeton d’annulation', () => {
    const view = toActiveTicketView(snap, 'DDD', 'tok-123')!;
    expect(view.ticket).toMatchObject({
      peopleAhead: 1,
      customerName: 'Nadia',
      etaMin: 15,
      kind: 'appointment',
      scheduledFor: '2026-09-24T10:30:00.000Z',
    });
    expect(view.nowServing).toBe(2);
    expect(view.cancelToken).toBe('tok-123');
    expect(view.updatedAt).toBe(snap.updatedAt);
  });

  it('ramène la position −1 d’un ticket en cours à 0 et retient le jeton d’annulation', () => {
    const view = toActiveTicketView(snap, 'AAA', 'tok-123')!;
    expect(view.ticket.peopleAhead).toBe(0);
    expect(view.cancelToken).toBeNull();
  });

  it('laisse le jeton d’annulation à un ticket appelé', () => {
    expect(toActiveTicketView(snap, 'BBB', 'tok-123')!.cancelToken).toBe('tok-123');
  });

  it('renvoie null pour un code absent de la file', () => {
    expect(toActiveTicketView(snap, 'ZZZ', 'tok-123')).toBeNull();
  });

  it('n’expose ni l’identifiant d’agence ni les données des autres clients', () => {
    const view = toActiveTicketView(snap, 'CCC', null)!;
    expect(view.branch.branchName).toBe('Agence Maârif');
    for (const key of ['branchId', 'tickets', 'stats', 'activeEmployees', 'updatedAt']) {
      expect(view.branch, `branch.${key}`).not.toHaveProperty(key);
    }
    const json = JSON.stringify(view);
    for (const other of ['Karim', 'Imane', 'Nadia', '+2126', 'AAA', 'BBB', 'DDD', 'branch-secret-id']) {
      expect(json, `« ${other} » exposé`).not.toContain(other);
    }
  });
});

describe('detectTransitions', () => {
  it('ne notifie rien sans instantané précédent', () => {
    expect(detectTransitions(undefined, snapshot([ticket('a', { status: 'called', position: -1 })]))).toEqual([]);
  });

  it('notifie un ticket nouvellement appelé', () => {
    const prev = snapshot([ticket('a', { position: 0 })]);
    const next = snapshot([ticket('a', { status: 'called', position: -1, calledAt: '2026-09-24T09:05:00.000Z' })]);
    expect(detectTransitions(prev, next)).toEqual([{ ticketId: 'a', kind: 'called' }]);
  });

  it('ne renotifie pas quand le staff annule « Démarrer » (retour à appelé, même heure d’appel)', () => {
    const calledAt = '2026-09-24T09:05:00.000Z';
    const prev = snapshot([ticket('a', { status: 'in_progress', position: -1, calledAt, startedAt: '2026-09-24T09:06:00.000Z' })]);
    const next = snapshot([ticket('a', { status: 'called', position: -1, calledAt })]);
    expect(detectTransitions(prev, next)).toEqual([]);
  });

  it('ticket absent de l’instantané précédent : notifie seulement un appel récent', () => {
    const calledAt = '2026-09-24T09:05:00.000Z';
    const at = Date.parse(calledAt);
    const next = snapshot([ticket('a', { status: 'called', position: -1, calledAt })]);
    // Annulation d'un « Terminé » : l'appel date de 20 min → pas de nouvelle notification.
    expect(detectTransitions(snapshot([]), next, 2, at + 20 * 60_000)).toEqual([]);
    // Ticket créé puis appelé entre deux instantanés → notification.
    expect(detectTransitions(snapshot([]), next, 2, at + 10_000)).toEqual([{ ticketId: 'a', kind: 'called' }]);
  });

  it('notifie un rappel (recallCount incrémenté), pas un simple rafraîchissement', () => {
    const called = ticket('a', { status: 'called', position: -1, recallCount: 0 });
    expect(detectTransitions(snapshot([called]), snapshot([{ ...called, recallCount: 1 }]))).toEqual([{ ticketId: 'a', kind: 'called' }]);
    expect(detectTransitions(snapshot([called]), snapshot([{ ...called }]))).toEqual([]);
  });

  it('prévient « bientôt » en passant de la 3e à la 2e place, sans répéter ensuite', () => {
    const move = (from: number, to: number, threshold?: number) =>
      detectTransitions(snapshot([ticket('a', { position: from })]), snapshot([ticket('a', { position: to })]), threshold);
    expect(move(3, 2)).toEqual([{ ticketId: 'a', kind: 'soon' }]);
    expect(move(4, 1)).toEqual([{ ticketId: 'a', kind: 'soon' }]);
    expect(move(2, 1)).toEqual([]);
    expect(move(5, 4)).toEqual([]);
    expect(move(1, 0, 0)).toEqual([{ ticketId: 'a', kind: 'soon' }]); // seuil personnalisé
  });

  it('notifie un RDV qui entre dans la file, pas un client sans RDV', () => {
    const next = snapshot([
      ticket('rdv', { kind: 'appointment', scheduledFor: '2026-09-24T10:00:00.000Z', position: 0 }),
      ticket('walk', { kind: 'walkin', position: 1 }),
    ]);
    expect(detectTransitions(snapshot([]), next)).toEqual([{ ticketId: 'rdv', kind: 'appointment' }]);
  });

  it('ne notifie pas le passage en cours de service', () => {
    const prev = snapshot([ticket('a', { status: 'called', position: -1 })]);
    const next = snapshot([ticket('a', { status: 'in_progress', position: -1 })]);
    expect(detectTransitions(prev, next)).toEqual([]);
  });
});
