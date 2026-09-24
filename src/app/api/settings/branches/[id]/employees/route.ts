import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { requireOwnBranch } from '@/lib/branch';
import { assertCanAdd } from '@/lib/plans';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({ name: z.string().trim().min(1).max(100) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  await requireOwnBranch(auth, id);
  const data = await parseBody(req, schema);
  await assertCanAdd(auth.orgId, 'employees');
  const employee = await prisma.employee.create({ data: { branchId: id, name: data.name } });
  // Le nombre d'employés actifs change les estimations d'attente.
  await publishBranchUpdate(id);
  return NextResponse.json(employee, { status: 201 });
});
