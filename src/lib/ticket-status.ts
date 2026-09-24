// Machine à états des tickets. Les retours arrière existent pour permettre
// l'« Annuler » du dashboard (clic malheureux) et la remise en file d'un absent.

export const TICKET_STATUSES = [
  'scheduled', // RDV futur, hors file
  'waiting',
  'called',
  'in_progress',
  'done',
  'no_show',
  'cancelled',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ACTIVE_STATUSES = ['waiting', 'called', 'in_progress'] as const;
export const TERMINAL_STATUSES = ['done', 'no_show', 'cancelled'] as const;

const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  scheduled: ['waiting', 'cancelled'],
  waiting: ['called', 'in_progress', 'cancelled'],
  called: ['in_progress', 'done', 'no_show', 'waiting', 'cancelled'],
  in_progress: ['done', 'no_show', 'called', 'cancelled'],
  // Retours arrière = « Annuler » du dashboard : chaque action doit pouvoir être défaite.
  done: ['in_progress', 'called'],
  no_show: ['waiting', 'called', 'in_progress'],
  cancelled: ['waiting'],
};

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isActiveStatus(value: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(value);
}

export function isTerminalStatus(value: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: string, to: string): boolean {
  if (!isTicketStatus(from) || !isTicketStatus(to)) return false;
  return TRANSITIONS[from].includes(to);
}

/**
 * Horodatages et compteurs de fidélité à appliquer lors d'une transition.
 * Les compteurs sont symétriques : quitter `done` retire la visite comptée.
 */
export function transitionEffects(
  from: TicketStatus,
  to: TicketStatus,
  current: { calledAt: Date | null; startedAt: Date | null },
  now: Date
) {
  const data: {
    status: TicketStatus;
    calledAt?: Date | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  } = { status: to };

  if (to === 'called' && !current.calledAt) data.calledAt = now;
  if (to === 'in_progress' && !current.startedAt) data.startedAt = now;
  if (to === 'in_progress' && !current.calledAt) data.calledAt = now;
  if (isTerminalStatus(to)) data.completedAt = now;
  if (isTerminalStatus(from) && !isTerminalStatus(to)) data.completedAt = null;
  // Remise en file : le ticket redevient « à appeler ».
  if (to === 'waiting') {
    data.calledAt = null;
    data.startedAt = null;
  }
  // Un ticket « appelé » n'a pas (encore) commencé : on efface un éventuel début périmé.
  if (to === 'called' && current.startedAt) data.startedAt = null;

  const visits = (to === 'done' ? 1 : 0) - (from === 'done' ? 1 : 0);
  const noShows = (to === 'no_show' ? 1 : 0) - (from === 'no_show' ? 1 : 0);
  return { data, visits, noShows };
}
