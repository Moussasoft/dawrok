import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { requireOwnBranch } from '@/lib/branch';
import { audit } from '@/lib/audit';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({
  closedUntil: z.string().datetime().nullable().optional(), // ISO, ou null pour rouvrir
  reason: z.string().trim().max(200).optional().nullable(),
});

// PATCH /api/branches/[id]/closure → mettre en pause / rouvrir la file
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  const data = await parseBody(req, schema);
  await requireOwnBranch(auth, id);

  const closedUntil = data.closedUntil ? new Date(data.closedUntil) : null;
  await prisma.branch.update({
    where: { id },
    data: { closedUntil, closureReason: closedUntil ? data.reason || null : null },
  });
  await audit({
    actor: auth,
    action: closedUntil ? 'branch.close' : 'branch.reopen',
    branchId: id,
    targetType: 'branch',
    targetId: id,
    metadata: { closedUntil: closedUntil?.toISOString(), reason: data.reason ?? null },
  });
  await publishBranchUpdate(id);
  return NextResponse.json({ ok: true });
});
