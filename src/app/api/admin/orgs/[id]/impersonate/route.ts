import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { createSession, setSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';

// Session « en tant que » propriétaire, en gardant la trace du superadmin (revérifiée à chaque requête).
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const auth = await requireSuperadmin();
  const { id } = await ctx.params;

  const owner = await prisma.user.findFirst({ where: { orgId: id, role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new ApiError(404, 'owner_not_found');

  await setSessionCookie(await createSession({ userId: owner.id, impersonatedFromUserId: auth.actorId }));
  await audit({
    action: 'impersonate.start',
    actor: auth,
    orgId: id,
    targetType: 'organization',
    targetId: id,
    metadata: { ownerEmail: owner.email },
  });
  return NextResponse.json({ ok: true });
});
