import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { bus, channels } from '@/lib/events';
import { buildSnapshot } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Server-Sent Events — live snapshot for a branch (dashboard).
export async function GET(req: NextRequest, ctx: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await ctx.params;
  const branch = await prisma.branch.findUnique({ where: { qrToken } });
  if (!branch) return new Response('Not found', { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      // initial snapshot
      const snap = await buildSnapshot(branch.id);
      send(snap);

      const unsub = bus.subscribe(channels.branch(branch.id), (data) => send(data));

      // heartbeat every 25s
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25000);

      // ETA refresh every 30s (publish a fresh snapshot)
      const refresh = setInterval(async () => {
        try {
          const fresh = await buildSnapshot(branch.id);
          send(fresh);
        } catch {
          /* ignore */
        }
      }, 30000);

      const close = () => {
        clearInterval(heartbeat);
        clearInterval(refresh);
        unsub();
        try { controller.close(); } catch { /* ignore */ }
      };
      req.signal.addEventListener('abort', close);
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
