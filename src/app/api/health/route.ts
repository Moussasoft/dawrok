import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { DEFAULT_TIMEZONE, formatHm, getZonedParts, hasOutdatedZoneRules } from '@/lib/time';

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
  // Heure du fuseau par défaut telle que l'application la calcule. `tzCorrected` : la base tz du
  // moteur est dépassée et l'application compense (l'heure reste juste, Node est à mettre à jour).
  const local = getZonedParts(new Date(), DEFAULT_TIMEZONE);
  return NextResponse.json({
    ok: true,
    db: 'up',
    redis: cache,
    latencyMs: Date.now() - startedAt,
    localTime: formatHm(local.hour * 60 + local.minute),
    tzCorrected: hasOutdatedZoneRules(),
  });
}
