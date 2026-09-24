// Types des instantanés de file, partagés entre serveur et composants client.
// Ce fichier ne doit importer aucun module serveur (Prisma, etc.).

export type ActiveStatus = 'waiting' | 'called' | 'in_progress';

export type BranchInfo = {
  branchId: string;
  branchName: string;
  orgName: string;
  brandColor: string;
  logoUrl: string | null;
  timezone: string;
  closedUntil: string | null;
  closureReason: string | null;
  isPaused: boolean;
  /** Dans les horaires d'ouverture (toujours vrai si aucun horaire n'est configuré). */
  isOpenNow: boolean;
  nextOpening: { weekday: number; time: string; today: boolean } | null;
};

/** Ticket actif tel que vu par le dashboard (données complètes, flux authentifié). */
export type QueueTicket = {
  id: string;
  publicCode: string;
  number: number;
  customerName: string;
  customerPhone: string | null;
  status: ActiveStatus;
  kind: string;
  priority: number;
  serviceId: string | null;
  serviceName: string | null;
  serviceColor: string | null;
  employeeId: string | null;
  employeeName: string | null;
  /** Rang parmi les tickets en attente (0 = prochain), -1 pour un ticket en cours. */
  position: number;
  etaMin: number;
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  scheduledFor: string | null;
  recallCount: number;
};

export type DayStats = {
  total: number;
  done: number;
  noShow: number;
  cancelled: number;
  /** Attente réelle moyenne (arrivée → appel) des tickets appelés aujourd'hui. */
  avgWaitMin: number;
  /** Durée moyenne de service (début → fin) des tickets terminés aujourd'hui. */
  avgServiceMin: number;
};

export type DashboardSnapshot = BranchInfo & {
  updatedAt: string;
  activeEmployees: number;
  tickets: QueueTicket[];
  stats: DayStats;
};

/** Ticket anonymisé pour l'écran TV et la page publique : ni nom, ni code, ni identifiant. */
export type PublicTicket = {
  number: number;
  status: ActiveStatus;
  serviceName: string | null;
  employeeName: string | null;
  position: number;
  etaMin: number;
  calledAt: string | null;
  recallCount: number;
};

export type PublicSnapshot = Omit<BranchInfo, 'branchId'> & {
  updatedAt: string;
  waitingCount: number;
  servingCount: number;
  tickets: PublicTicket[];
};

/** Vue d'un ticket pour son détenteur (page /t/[publicCode]). */
export type TicketView = {
  updatedAt: string;
  branch: Omit<BranchInfo, 'branchId'>;
  ticket: {
    number: number;
    status: string;
    kind: string;
    customerName: string;
    serviceName: string | null;
    employeeName: string | null;
    /** Personnes en attente devant ce ticket (0 = prochain). */
    peopleAhead: number;
    etaMin: number;
    scheduledFor: string | null;
    calledAt: string | null;
    recallCount: number;
  };
  /** Clients en cours de service (appelés ou en cours). */
  nowServing: number;
  cancelToken: string | null;
};
