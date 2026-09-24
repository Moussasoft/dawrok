// Fiches clients : accès limité à l'organisation, et périmètre des tickets d'un client
// (liés à sa fiche, ou saisis avec son numéro dans la même agence).
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { ApiError } from './api';
import type { OrgAuth } from './guards';

export async function requireOwnCustomer(auth: OrgAuth, id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { branch: { select: { orgId: true, name: true, organization: { select: { name: true } } } } },
  });
  if (!customer || customer.branch.orgId !== auth.orgId) throw new ApiError(404, 'not_found');
  return customer;
}

export function customerTicketsWhere(customer: { id: string; branchId: string; phone: string }): Prisma.TicketWhereInput {
  return { OR: [{ customerId: customer.id }, { branchId: customer.branchId, customerPhone: customer.phone }] };
}
