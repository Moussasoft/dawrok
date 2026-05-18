import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSuperadmin } from '@/lib/admin-guard';
import { audit } from '@/lib/audit';

const schema = z.object({ suspended: z.boolean() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperadmin();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  await prisma.organization.update({
    where: { id },
    data: { suspended: parsed.data.suspended },
  });
  await audit({
    action: parsed.data.suspended ? 'org.suspend' : 'org.reactivate',
    session: guard.session,
    orgId: id,
    targetType: 'organization',
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
