import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrgRole, type OrgAuth } from '@/lib/guards';
import { publishBranchUpdate } from '@/lib/queue';
import { assertCanAdd } from '@/lib/plans';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function findOwnEmployee(auth: OrgAuth, id: string) {
  const employee = await prisma.employee.findFirst({ where: { id, branch: { orgId: auth.orgId } } });
  if (!employee) throw new ApiError(404, 'not_found');
  return employee;
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireOrgRole('manager');
  const { id } = await ctx.params;
  const employee = await findOwnEmployee(auth, id);
  const data = await parseBody(req, patchSchema);
  // Réactiver compte dans la limite de l'offre, comme une création.
  if (data.active === true && !employee.active) await assertCanAdd(auth.orgId, 'employees');
  const updated = await prisma.employee.update({ where: { id }, data });
  await publishBranchUpdate(employee.branchId);
  return NextResponse.json(updated);
});

// Un employé ayant déjà servi des clients est désactivé plutôt que supprimé (statistiques conservées).
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireOrgRole('manager');
  const { id } = await ctx.params;
  const employee = await findOwnEmployee(auth, id);
  const used = await prisma.ticket.count({ where: { employeeId: id } });
  if (used > 0) {
    await prisma.employee.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.employee.delete({ where: { id } });
  }
  await publishBranchUpdate(employee.branchId);
  return NextResponse.json({ ok: true, archived: used > 0 });
});
