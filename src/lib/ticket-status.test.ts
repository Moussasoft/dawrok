import { describe, expect, it } from 'vitest';
import {
  TICKET_STATUSES,
  canTransition,
  isActiveStatus,
  isTerminalStatus,
  isTicketStatus,
  transitionEffects,
  type TicketStatus,
} from './ticket-status';

// Spécification des transitions : les retours arrière servent à l'« Annuler » du dashboard
// (chaque action doit pouvoir être défaite) et à la remise en file d'un absent.
const ALLOWED: Record<TicketStatus, TicketStatus[]> = {
  scheduled: ['waiting', 'cancelled'],
  waiting: ['called', 'in_progress', 'cancelled'],
  called: ['in_progress', 'done', 'no_show', 'waiting', 'cancelled'],
  in_progress: ['done', 'no_show', 'called', 'cancelled'],
  done: ['in_progress', 'called'],
  no_show: ['waiting', 'called', 'in_progress'],
  cancelled: ['waiting'],
};

const NOW = new Date('2026-09-24T10:00:00Z');
const EARLIER = new Date('2026-09-24T09:30:00Z');
const FRESH = { calledAt: null, startedAt: null };

describe('canTransition', () => {
  it('suit exactement la matrice des transitions autorisées', () => {
    const mismatches: string[] = [];
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        const expected = ALLOWED[from].includes(to);
        if (canTransition(from, to) !== expected) mismatches.push(`${from} → ${to} (attendu : ${expected})`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.each([
    ['waiting', 'called'],
    ['called', 'in_progress'],
    ['in_progress', 'done'],
    ['called', 'waiting'],
    ['done', 'in_progress'],
    ['done', 'called'],
    ['no_show', 'waiting'],
    ['no_show', 'in_progress'],
    ['cancelled', 'waiting'],
  ])('autorise %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['waiting', 'done'],
    ['waiting', 'no_show'],
    ['waiting', 'waiting'],
    ['scheduled', 'called'],
    ['done', 'waiting'],
    ['done', 'cancelled'],
    ['no_show', 'done'],
    ['cancelled', 'called'],
    ['called', 'scheduled'],
  ])('interdit %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('refuse les statuts inconnus', () => {
    expect(canTransition('foo', 'waiting')).toBe(false);
    expect(canTransition('waiting', 'bar')).toBe(false);
    expect(canTransition('WAITING', 'called')).toBe(false);
    expect(canTransition('constructor', 'waiting')).toBe(false);
    expect(canTransition('', '')).toBe(false);
  });
});

describe('isTicketStatus / isActiveStatus / isTerminalStatus', () => {
  it('classe les statuts', () => {
    expect(isTicketStatus('scheduled')).toBe(true);
    expect(isTicketStatus('archived')).toBe(false);
    expect(TICKET_STATUSES.filter(isActiveStatus)).toEqual(['waiting', 'called', 'in_progress']);
    expect(TICKET_STATUSES.filter(isTerminalStatus)).toEqual(['done', 'no_show', 'cancelled']);
  });
});

describe('transitionEffects', () => {
  it('horodate l’appel', () => {
    expect(transitionEffects('waiting', 'called', FRESH, NOW)).toStrictEqual({
      data: { status: 'called', calledAt: NOW },
      visits: 0,
      noShows: 0,
    });
  });

  it('un démarrage direct horodate l’appel et le début', () => {
    expect(transitionEffects('waiting', 'in_progress', FRESH, NOW).data).toStrictEqual({
      status: 'in_progress',
      calledAt: NOW,
      startedAt: NOW,
    });
  });

  it('conserve l’heure d’appel existante au démarrage', () => {
    expect(transitionEffects('called', 'in_progress', { calledAt: EARLIER, startedAt: null }, NOW).data).toStrictEqual({
      status: 'in_progress',
      startedAt: NOW,
    });
  });

  it('la remise en file efface calledAt et startedAt', () => {
    expect(transitionEffects('called', 'waiting', { calledAt: EARLIER, startedAt: null }, NOW).data).toStrictEqual({
      status: 'waiting',
      calledAt: null,
      startedAt: null,
    });
  });

  it('revenir de in_progress à called efface startedAt', () => {
    expect(transitionEffects('in_progress', 'called', { calledAt: EARLIER, startedAt: EARLIER }, NOW).data).toStrictEqual({
      status: 'called',
      startedAt: null,
    });
  });

  it('entrer dans un statut terminal fixe completedAt', () => {
    for (const to of ['done', 'no_show', 'cancelled'] as const) {
      expect(transitionEffects('called', to, { calledAt: EARLIER, startedAt: null }, NOW).data.completedAt).toBe(NOW);
    }
  });

  it('quitter un statut terminal efface completedAt', () => {
    expect(transitionEffects('done', 'in_progress', { calledAt: EARLIER, startedAt: EARLIER }, NOW).data).toStrictEqual({
      status: 'in_progress',
      completedAt: null,
    });
    expect(transitionEffects('cancelled', 'waiting', FRESH, NOW).data).toStrictEqual({
      status: 'waiting',
      completedAt: null,
      calledAt: null,
      startedAt: null,
    });
  });

  it('annuler un « terminé » revient à called sans toucher à l’heure d’appel', () => {
    expect(transitionEffects('done', 'called', { calledAt: EARLIER, startedAt: null }, NOW)).toStrictEqual({
      data: { status: 'called', completedAt: null },
      visits: -1,
      noShows: 0,
    });
  });

  it('annuler un « absent » revient à in_progress en gardant les horodatages', () => {
    expect(transitionEffects('no_show', 'in_progress', { calledAt: EARLIER, startedAt: EARLIER }, NOW)).toStrictEqual({
      data: { status: 'in_progress', completedAt: null },
      visits: 0,
      noShows: -1,
    });
  });

  it('compte visites et absences de façon symétrique', () => {
    const path: [TicketStatus, TicketStatus][] = [
      ['waiting', 'called'],
      ['called', 'in_progress'],
      ['in_progress', 'done'],
    ];
    expect(path.map(([from, to]) => transitionEffects(from, to, FRESH, NOW).visits)).toEqual([0, 0, 1]);
    expect(transitionEffects('done', 'in_progress', FRESH, NOW).visits).toBe(-1);
    expect(transitionEffects('done', 'called', FRESH, NOW).visits).toBe(-1);
    expect(transitionEffects('called', 'no_show', FRESH, NOW)).toMatchObject({ visits: 0, noShows: 1 });
    for (const to of ['waiting', 'called', 'in_progress'] as const) {
      expect(transitionEffects('no_show', to, FRESH, NOW).noShows).toBe(-1);
    }
  });

  it('un aller-retour autorisé (action puis « Annuler ») laisse les compteurs inchangés', () => {
    for (const from of TICKET_STATUSES) {
      for (const to of ALLOWED[from]) {
        if (!canTransition(to, from)) continue;
        const go = transitionEffects(from, to, FRESH, NOW);
        const back = transitionEffects(to, from, FRESH, NOW);
        expect(go.visits + back.visits, `${from} ⇄ ${to}`).toBe(0);
        expect(go.noShows + back.noShows, `${from} ⇄ ${to}`).toBe(0);
      }
    }
  });

  it('sur un parcours complet, les compteurs ne reflètent que l’état final', () => {
    const statuses: TicketStatus[] = ['waiting', 'called', 'no_show', 'waiting', 'called', 'in_progress', 'done', 'in_progress', 'done'];
    let visits = 0;
    let noShows = 0;
    for (let i = 1; i < statuses.length; i++) {
      expect(canTransition(statuses[i - 1], statuses[i])).toBe(true);
      const r = transitionEffects(statuses[i - 1], statuses[i], FRESH, NOW);
      visits += r.visits;
      noShows += r.noShows;
    }
    expect({ visits, noShows }).toEqual({ visits: 1, noShows: 0 });
  });

  // Incohérence : in_progress → called efface startedAt, mais done → called (nouvelle transition
  // « Annuler ») garde le startedAt d'un ticket qui avait été démarré → statut « called » avec
  // un début de service. Même chose pour no_show → called. Non atteignable via l'« Annuler »
  // du dashboard (qui revient au statut précédent), mais possible via PATCH /api/tickets/[id].
  it('revenir à called depuis done ne laisse pas de startedAt périmé', () => {
    const { data } = transitionEffects('done', 'called', { calledAt: EARLIER, startedAt: EARLIER }, NOW);
    expect(data.startedAt).toBeNull();
  });
});
