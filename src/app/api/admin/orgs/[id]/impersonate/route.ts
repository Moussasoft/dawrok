import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperadmin } from '@/lib/admin-guard';
import { createSession, setSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';

// Issue a new session as the org owner, while keeping a marker that we're impersonating.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperadmin();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;

  const owner = await prisma.user.findFirst({
    where: { orgId: id, role: 'owner' },
  });
  if (!owner) return NextResponse.json({ error: 'Owner introuvable' }, { status: 404 });

  const token = await createSession({
    userId: owner.id,
    orgId: owner.orgId,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    isSuperadmin: true, // keep superadmin flag to allow stop-impersonation
    impersonatedFromUserId: guard.session!.userId,
  });
  await setSessionCookie(token);
  await audit({
    action: 'impersonate.start',
    session: guard.session,
    orgId: id,
    targetType: 'organization',
    targetId: id,
    metadata: { ownerEmail: owner.email },
  });
  return NextResponse.json({ ok: true });
}
