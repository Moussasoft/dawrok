// Agence active du dashboard (multi-succursales) : mémorisée dans un cookie,
// toujours revalidée contre l'organisation de l'utilisateur.
import { cookies } from 'next/headers';
import { prisma } from './db';
import { ApiError } from './api';
import type { OrgAuth } from './guards';

export const BRANCH_COOKIE = 'daourak_branch';

export function listOrgBranches(orgId: string) {
  return prisma.branch.findMany({ where: { orgId }, orderBy: { createdAt: 'asc' } });
}

export async function getActiveBranch(auth: OrgAuth) {
  const wanted = (await cookies()).get(BRANCH_COOKIE)?.value;
  if (wanted) {
    const branch = await prisma.branch.findFirst({ where: { id: wanted, orgId: auth.orgId } });
    if (branch) return branch;
  }
  return prisma.branch.findFirst({ where: { orgId: auth.orgId }, orderBy: { createdAt: 'asc' } });
}

/** Agence appartenant à l'organisation, sinon 404 (pas de fuite d'existence). */
export async function requireOwnBranch(auth: OrgAuth, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId: auth.orgId } });
  if (!branch) throw new ApiError(404, 'branch_not_found');
  return branch;
}
