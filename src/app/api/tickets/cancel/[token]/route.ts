import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { publishBranchUpdate } from '@/lib/queue';
import { audit } from '@/lib/audit';

// Public cancel by cancelToken (client-driven cancel from their ticket page)
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 });
  }
  const ticket = await prisma.ticket.findUnique({
    where: { cancelToken: token },
    include: { customer: true },
  });
  if (!ticket) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (!['waiting', 'called'].includes(ticket.status)) {
    return NextResponse.json({ error: 'Ticket non annulable' }, { status: 409 });
  }
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'cancelled', completedAt: new Date(), cancelToken: null },
  });
  await audit({
    action: 'ticket.cancel.client',
    branchId: ticket.branchId,
    targetType: 'ticket',
    targetId: ticket.id,
    metadata: { number: ticket.number, customer: ticket.customerName },
  });
  await publishBranchUpdate(ticket.branchId);
  return NextResponse.json({ ok: true });
}
