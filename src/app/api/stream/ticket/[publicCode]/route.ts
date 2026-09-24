import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { followBranch, getTicketView } from '@/lib/queue';
import { sseResponse } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Flux d'un ticket pour son détenteur : le publicCode (URL privée du client) sert de clé d'accès.
export async function GET(req: NextRequest, ctx: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await ctx.params;
  const ticket = await prisma.ticket.findUnique({ where: { publicCode }, select: { branchId: true } });
  if (!ticket) return new Response('Not found', { status: 404 });

  return sseResponse(req, (send) => {
    let last = '';
    // followBranch sérialise les appels : les vues partent dans l'ordre, sans doublon.
    return followBranch(ticket.branchId, async (snap) => {
      // Le jeton d'annulation peut avoir été consommé : on relit la ligne.
      const fresh = await prisma.ticket.findUnique({ where: { publicCode }, select: { cancelToken: true } });
      const view = await getTicketView(snap, { publicCode, cancelToken: fresh?.cancelToken ?? null });
      // On n'émet que si quelque chose a changé pour ce client (hors horodatage).
      const serialized = JSON.stringify({ ...view, updatedAt: undefined });
      if (serialized === last) return;
      last = serialized;
      send(view);
    });
  });
}
