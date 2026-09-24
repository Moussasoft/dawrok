import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { audit } from '@/lib/audit';

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const auth = await requireOrgRole('owner');
  const { id } = await ctx.params;
  const res = await prisma.invitation.deleteMany({ where: { id, orgId: auth.orgId, acceptedAt: null } });
  if (res.count === 0) throw new ApiError(404, 'not_found');
  await audit({ action: 'team.invite_revoke', actor: auth, targetType: 'invitation', targetId: id });
  return NextResponse.json({ ok: true });
});
