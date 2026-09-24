// Planification de la purge dans le processus Node (démarrée par instrumentation.ts).
// Sur une plateforme sans processus permanent (serverless), utiliser /api/cron/retention.
import { prisma } from './db';
import { purgeExpiredData, type PurgeReport } from './retention';

const LAST_RUN_KEY = 'retention.lastRunAt';
const CHECK_EVERY_MS = 6 * 3600_000;
/** Une purge par jour au plus, même avec plusieurs instances ou redémarrages. */
const MIN_GAP_MS = 20 * 3600_000;

export async function runRetentionIfDue(now = new Date()): Promise<PurgeReport | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key: LAST_RUN_KEY } });
  const last = row ? Date.parse(JSON.parse(row.value) as string) : NaN;
  if (Number.isFinite(last) && now.getTime() - last < MIN_GAP_MS) return null;
  const value = JSON.stringify(now.toISOString());
  await prisma.systemConfig.upsert({ where: { key: LAST_RUN_KEY }, update: { value }, create: { key: LAST_RUN_KEY, value } });
  return purgeExpiredData(now);
}

export function startRetentionScheduler() {
  const g = globalThis as unknown as { __retentionTimer?: ReturnType<typeof setInterval> };
  if (g.__retentionTimer) return;
  const tick = () => {
    runRetentionIfDue()
      .then((report) => report && console.info('[retention] purge effectuée', JSON.stringify(report)))
      .catch((e) => console.error('[retention] échec de la purge', e));
  };
  setTimeout(tick, 60_000).unref();
  g.__retentionTimer = setInterval(tick, CHECK_EVERY_MS);
  g.__retentionTimer.unref();
}
