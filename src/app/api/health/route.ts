import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Supervision (UptimeRobot, Better Stack…) : 200 si l'application et la base répondent.
// Redis est signalé (up / down / off) sans faire échouer le contrôle : l'app se replie en mémoire.
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 });
  }
  const clients = redis();
  let cache: 'up' | 'down' | 'off' = 'off';
  if (clients) {
    cache = clients.cmd.status !== 'ready' ? 'down' : await clients.cmd.ping().then(() => 'up' as const, () => 'down' as const);
  }
  return NextResponse.json({ ok: true, db: 'up', redis: cache, latencyMs: Date.now() - startedAt });
}
