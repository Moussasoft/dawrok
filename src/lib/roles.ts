// Rôles d'équipe. owner : tout (équipe, facturation, organisation) ; manager : file,
// analytics, clients et réglages des agences ; staff : la file uniquement.
export const ROLES = ['owner', 'manager', 'staff'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Le rôle atteint-il au moins le niveau demandé ? (un rôle inconnu n'a aucun droit) */
export function hasRole(role: string, min: Role): boolean {
  return isRole(role) && RANK[role] >= RANK[min];
}

/**
 * Un changement ou une suppression laisserait-il l'organisation sans propriétaire ?
 * `owners` = nombre actuel de propriétaires.
 */
export function wouldLeaveNoOwner(currentRole: string, nextRole: Role | null, owners: number): boolean {
  return currentRole === 'owner' && nextRole !== 'owner' && owners <= 1;
}
