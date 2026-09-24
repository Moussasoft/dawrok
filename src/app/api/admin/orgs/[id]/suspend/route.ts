import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { audit } from '@/lib/audit';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({ suspended: z.boolean() });

// Effet immédiat : les sessions de l'organisation sont revérifiées à chaque requête.
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const auth = await requireSuperadmin();
  const { id } = await ctx.params;
  const { suspended } = await parseBody(req, schema);

  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true } });
  if (!org) throw new ApiError(404, 'not_found');
  await prisma.organization.update({ where: { id }, data: { suspended } });
  await audit({
    action: suspended ? 'org.suspend' : 'org.reactivate',
    actor: auth,
    orgId: id,
    targetType: 'organization',
    targetId: id,
  });
  const branches = await prisma.branch.findMany({ where: { orgId: id }, select: { id: true } });
  await Promise.all(branches.map((b) => publishBranchUpdate(b.id)));
  return NextResponse.json({ ok: true });
});
