import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { audit } from '@/lib/audit';

// Révocation : effet immédiat, les sessions étant revérifiées en base à chaque requête.
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const auth = await requireSuperadmin();
  const { id } = await ctx.params;
  if (id === auth.actorId) throw new ApiError(400, 'cannot_revoke_self');

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || !target.isSuperadmin) throw new ApiError(404, 'not_found');
  if ((await prisma.user.count({ where: { isSuperadmin: true } })) <= 1) throw new ApiError(409, 'last_superadmin');

  // Un superadmin rattaché à une organisation perd seulement ses droits ; sinon le compte est supprimé.
  if (target.orgId) await prisma.user.update({ where: { id }, data: { isSuperadmin: false } });
  else await prisma.user.delete({ where: { id } });

  await audit({ action: 'superadmin.revoke', actor: auth, targetType: 'user', targetId: id, metadata: { email: target.email } });
  return NextResponse.json({ ok: true });
});
