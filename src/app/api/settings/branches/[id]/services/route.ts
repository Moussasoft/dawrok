import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { requireOwnBranch } from '@/lib/branch';
import { assertCanAdd } from '@/lib/plans';

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  avgDurationMin: z.number().int().min(1).max(480),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  await requireOwnBranch(auth, id);
  const data = await parseBody(req, schema);
  await assertCanAdd(auth.orgId, 'services');
  const service = await prisma.service.create({ data: { branchId: id, ...data } });
  return NextResponse.json(service, { status: 201 });
});
