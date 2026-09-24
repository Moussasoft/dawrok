// Redis optionnel (REDIS_URL) : état partagé entre plusieurs instances de l'application —
// diffusion temps réel, limitation de débit et dédoublonnage des notifications.
// Sans Redis (une seule instance), tout reste en mémoire ; si Redis tombe, repli en mémoire.
import crypto from 'crypto';
import Redis from 'ioredis';

export type RedisClients = { cmd: Redis; sub: Redis };

/** Identifiant de ce processus : ignore ses propres messages diffusés. */
export const INSTANCE_ID: string = crypto.randomUUID();

const g = globalThis as unknown as { __redis?: RedisClients | null };

export function redis(): RedisClients | null {
  if (g.__redis !== undefined) return g.__redis;
  const url = process.env.REDIS_URL;
  if (!url) return (g.__redis = null);
  // Délais courts : une commande qui échoue bascule sur le repli en mémoire au lieu de bloquer la requête.
  const options = { maxRetriesPerRequest: 1, commandTimeout: 1500, connectTimeout: 5000 };
  const cmd = new Redis(url, options);
  const sub = new Redis(url, options);
  // Reconnexions en boucle quand Redis est tombé : une ligne de journal par minute suffit.
  let lastLog = 0;
  const onError = (e: Error) => {
    if (Date.now() - lastLog < 60_000) return;
    lastLog = Date.now();
    console.error('[redis] indisponible, repli en mémoire :', e.message);
  };
  for (const client of [cmd, sub]) client.on('error', onError);
  return (g.__redis = { cmd, sub });
}

/** Clients prêts à répondre ; sinon (connexion en cours ou perdue) repli immédiat en mémoire. */
export function readyRedis(): RedisClients | null {
  const clients = redis();
  return clients && clients.cmd.status === 'ready' ? clients : null;
}

/** Tests : remplace les clients (ioredis-mock), ou null pour revenir au mode mémoire. */
export function setRedisClientsForTesting(clients: RedisClients | null) {
  g.__redis = clients;
}

// ─── Dédoublonnage ───────────────────────────────────────────────────────────

const memoryClaims = new Map<string, number>();
let lastSweep = 0;

/** Vrai pour le premier appelant (toutes instances confondues) pendant `ttlMs`. */
export async function claimOnce(key: string, ttlMs: number): Promise<boolean> {
  const r = readyRedis();
  if (r) {
    try {
      return (await r.cmd.set(`claim:${key}`, INSTANCE_ID, 'PX', ttlMs, 'NX')) === 'OK';
    } catch (e) {
      console.error('[redis] dédoublonnage indisponible, repli en mémoire', (e as Error).message);
    }
  }
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, exp] of memoryClaims) if (exp <= now) memoryClaims.delete(k);
  }
  const exp = memoryClaims.get(key);
  if (exp && exp > now) return false;
  memoryClaims.set(key, now + ttlMs);
  return true;
}

// ─── Limitation de débit (fenêtre glissante, atomique) ───────────────────────

const RATE_LIMIT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
if redis.call('ZCARD', key) >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, tonumber(oldest[2])}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

type RateLimitCommand = Redis & {
  daourakRateLimit(key: string, now: number, windowMs: number, limit: number, member: string): Promise<[number, number]>;
};

/** Même sémantique que le limiteur en mémoire : les essais refusés ne sont pas enregistrés. */
export async function redisRateLimitHit(
  client: Redis,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const c = client as RateLimitCommand;
  if (typeof c.daourakRateLimit !== 'function') client.defineCommand('daourakRateLimit', { numberOfKeys: 1, lua: RATE_LIMIT_LUA });
  const [allowed, oldest] = await c.daourakRateLimit(`rl:${key}`, now, windowMs, limit, `${now}-${crypto.randomUUID()}`);
  if (allowed === 1) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((Number(oldest) + windowMs - now) / 1000)) };
}
