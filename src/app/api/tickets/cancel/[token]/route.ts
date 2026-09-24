import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { publishBranchUpdate } from '@/lib/queue';
import { audit } from '@/lib/audit';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

// Annulation par le client depuis sa page de suivi (jeton reçu avec son ticket).
export const POST = route<{ params: Promise<{ token: string }> }>(async (req, ctx) => {
  enforceRateLimit(`cancel:ip:${clientIp(req)}`, 20, 10 * 60_000);
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{32}$/.test(token)) throw new ApiError(400, 'invalid_token');

  const ticket = await prisma.ticket.findUnique({ where: { cancelToken: token } });
  if (!ticket) throw new ApiError(404, 'not_found');
  if (!['waiting', 'called', 'scheduled'].includes(ticket.status)) throw new ApiError(409, 'ticket_not_cancellable');

  // Conditionnel : le ticket a pu être pris en charge entre-temps.
  const res = await prisma.ticket.updateMany({
    where: { id: ticket.id, cancelToken: token, status: { in: ['waiting', 'called', 'scheduled'] } },
    data: { status: 'cancelled', completedAt: new Date(), cancelToken: null },
  });
  if (res.count === 0) throw new ApiError(409, 'ticket_not_cancellable');
  await prisma.pushSubscription.deleteMany({ where: { ticketId: ticket.id } });
  await audit({
    action: 'ticket.cancel.client',
    branchId: ticket.branchId,
    targetType: 'ticket',
    targetId: ticket.id,
    metadata: { number: ticket.number },
  });
  await publishBranchUpdate(ticket.branchId);
  return NextResponse.json({ ok: true });
});
