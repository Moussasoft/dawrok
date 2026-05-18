import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({
  status: z.enum(['waiting', 'called', 'in_progress', 'done', 'no_show', 'cancelled']),
  employeeId: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { branch: true },
  });
  if (!ticket) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (ticket.branch.orgId !== session.orgId) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const now = new Date();
  const data: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.employeeId !== undefined) data.employeeId = parsed.data.employeeId;
  if (parsed.data.status === 'called' && !ticket.calledAt) data.calledAt = now;
  if (parsed.data.status === 'in_progress' && !ticket.startedAt) data.startedAt = now;
  if ((parsed.data.status === 'done' || parsed.data.status === 'no_show') && !ticket.completedAt) {
    data.completedAt = now;
  }

  await prisma.ticket.update({ where: { id }, data });

  // Customer fidelity counters
  if (ticket.customerId) {
    if (parsed.data.status === 'done' && ticket.status !== 'done') {
      await prisma.customer.update({
        where: { id: ticket.customerId },
        data: { totalVisits: { increment: 1 }, lastVisitAt: now },
      });
    } else if (parsed.data.status === 'no_show' && ticket.status !== 'no_show') {
      await prisma.customer.update({
        where: { id: ticket.customerId },
        data: { noShowCount: { increment: 1 } },
      });
    }
  }

  await publishBranchUpdate(ticket.branchId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await ctx.params;
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: { branch: true } });
  if (!ticket) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (ticket.branch.orgId !== session.orgId) return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  await prisma.ticket.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } });
  await publishBranchUpdate(ticket.branchId);
  return NextResponse.json({ ok: true });
}
