import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { audit } from '@/lib/audit';
import { PLANS } from '@/lib/plans';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ plan: z.enum(PLANS) });

// Changement de plan d'une organisation (auparavant impossible).
export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireSuperadmin();
  const { id } = await ctx.params;
  const { plan } = await parseBody(req, patchSchema);
  const org = await prisma.organization.findUnique({ where: { id }, select: { plan: true } });
  if (!org) throw new ApiError(404, 'not_found');
  await prisma.organization.update({ where: { id }, data: { plan } });
  await audit({
    action: 'org.plan',
    actor: auth,
    orgId: id,
    targetType: 'organization',
    targetId: id,
    metadata: { from: org.plan, to: plan },
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireSuperadmin();
  const { id } = await ctx.params;
  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  if (!org) throw new ApiError(404, 'not_found');
  if (auth.impersonating && auth.orgId === id) throw new ApiError(409, 'stop_impersonation_first');
  await prisma.organization.delete({ where: { id } });
  await audit({
    action: 'org.delete',
    actor: auth,
    targetType: 'organization',
    targetId: id,
    metadata: { name: org.name },
  });
  return NextResponse.json({ ok: true });
});
