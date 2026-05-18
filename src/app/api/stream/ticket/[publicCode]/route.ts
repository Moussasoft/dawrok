import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { bus, channels } from '@/lib/events';
import { buildSnapshot } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// SSE for a single client ticket (public)
export async function GET(req: NextRequest, ctx: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await ctx.params;
  const ticket = await prisma.ticket.findUnique({ where: { publicCode } });
  if (!ticket) return new Response('Not found', { status: 404 });

  const branchId = ticket.branchId;
  const encoder = new TextEncoder();

  const buildPayload = async () => {
    const snap = await buildSnapshot(branchId); // auto-promeut les RDV dus
    const t = snap.tickets.find((x) => x.publicCode === publicCode);

    // Ticket absent du snapshot actif → peut être encore 'scheduled' (RDV futur)
    if (!t) {
      const raw = await prisma.ticket.findUnique({
        where: { publicCode },
        select: { id: true, number: true, status: true, scheduledFor: true },
      });
      return {
        ticket: raw
          ? { id: raw.id, publicCode, number: raw.number, status: raw.status, position: -1, etaMin: 0 }
          : null,
        totalAhead: 0,
        nowServing: 0,
        branchName: snap.branchName,
        orgName: snap.orgName,
        brandColor: snap.brandColor,
        logoUrl: snap.logoUrl,
        closedUntil: snap.closedUntil,
        closureReason: snap.closureReason,
        isPaused: snap.isPaused,
        cancelToken: ticket.cancelToken,
        scheduledFor: raw?.scheduledFor?.toISOString() ?? null,
      };
    }

    // "Personnes avant vous" = tickets en statut `waiting` placés devant moi.
    // Les tickets `called` / `in_progress` sont en cours de service → exposés séparément.
    let totalAhead = 0;
    let nowServing = 0;
    let myIndex = -1;
    snap.tickets.forEach((x, i) => {
      if (x.publicCode === publicCode) myIndex = i;
    });
    if (myIndex >= 0) {
      const ahead = snap.tickets.slice(0, myIndex);
      totalAhead = ahead.filter((x) => x.status === 'waiting').length;
      nowServing = ahead.filter((x) => x.status === 'called' || x.status === 'in_progress').length;
    }
    return {
      ticket: t ?? null,
      totalAhead,
      nowServing,
      branchName: snap.branchName,
      orgName: snap.orgName,
      brandColor: snap.brandColor,
      logoUrl: snap.logoUrl,
      closedUntil: snap.closedUntil,
      closureReason: snap.closureReason,
      isPaused: snap.isPaused,
      cancelToken: ticket.cancelToken,
      scheduledFor: ticket.scheduledFor?.toISOString() ?? null,
    };
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send(await buildPayload());

      const unsub = bus.subscribe(channels.branch(branchId), async () => {
        send(await buildPayload());
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25000);

      const refresh = setInterval(async () => {
        try { send(await buildPayload()); } catch { /* ignore */ }
      }, 30000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clearInterval(refresh);
        unsub();
        try { controller.close(); } catch { /* ignore */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
