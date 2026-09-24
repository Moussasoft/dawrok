import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrgRole, type OrgAuth } from '@/lib/guards';
import { ROLES, wouldLeaveNoOwner } from '@/lib/roles';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

async function loadMember(auth: OrgAuth, id: string) {
  const member = await prisma.user.findFirst({ where: { id, orgId: auth.orgId } });
  if (!member) throw new ApiError(404, 'not_found');
  return member;
}

const ownersOf = (orgId: string) => prisma.user.count({ where: { orgId, role: 'owner' } });

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireOrgRole('owner');
  const { id } = await ctx.params;
  const { role } = await parseBody(req, z.object({ role: z.enum(ROLES) }));
  const member = await loadMember(auth, id);
  if (wouldLeaveNoOwner(member.role, role, await ownersOf(auth.orgId))) throw new ApiError(409, 'last_owner');
  await prisma.user.update({ where: { id }, data: { role } });
  await audit({ action: 'team.role', actor: auth, targetType: 'user', targetId: id, metadata: { from: member.role, to: role } });
  return NextResponse.json({ ok: true });
});

// Retirer un membre supprime son compte (un compte appartient à une seule organisation).
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireOrgRole('owner');
  const { id } = await ctx.params;
  if (id === auth.userId) throw new ApiError(409, 'cannot_remove_self');
  const member = await loadMember(auth, id);
  if (member.isSuperadmin) throw new ApiError(403, 'forbidden');
  if (wouldLeaveNoOwner(member.role, null, await ownersOf(auth.orgId))) throw new ApiError(409, 'last_owner');
  await prisma.user.delete({ where: { id } });
  await audit({ action: 'team.remove', actor: auth, targetType: 'user', targetId: id, metadata: { email: member.email } });
  return NextResponse.json({ ok: true });
});
