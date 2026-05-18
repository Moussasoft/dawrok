import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({
  closedUntil: z.string().datetime().nullable().optional(), // ISO date or null to reopen
  reason: z.string().max(200).optional().nullable(),
});

// PATCH /api/branches/[id]/closure  → pause / reopen the queue
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch || branch.orgId !== session.orgId) {
    return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  }

  const closedUntil = parsed.data.closedUntil ? new Date(parsed.data.closedUntil) : null;
  await prisma.branch.update({
    where: { id },
    data: {
      closedUntil,
      closureReason: closedUntil ? parsed.data.reason ?? null : null,
    },
  });
  await audit({
    session,
    action: closedUntil ? 'branch.close' : 'branch.reopen',
    branchId: id,
    targetType: 'branch',
    targetId: id,
    metadata: { closedUntil: closedUntil?.toISOString(), reason: parsed.data.reason ?? null },
  });
  await publishBranchUpdate(id);
  return NextResponse.json({ ok: true });
}
