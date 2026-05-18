import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperadmin } from '@/lib/admin-guard';
import { audit } from '@/lib/audit';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperadmin();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  await prisma.organization.delete({ where: { id } });
  await audit({
    action: 'org.delete',
    session: guard.session,
    targetType: 'organization',
    targetId: id,
    metadata: { name: org?.name },
  });
  return NextResponse.json({ ok: true });
}
