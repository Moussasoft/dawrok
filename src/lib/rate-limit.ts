// Limitation de débit (fenêtre glissante) : partagée via Redis si REDIS_URL est défini
// (plusieurs instances), sinon en mémoire — et repli en mémoire si Redis ne répond pas.
import type { NextRequest } from 'next/server';
import { ApiError } from './api';
import { readyRedis, redisRateLimitHit } from './redis';

// Chaque clé mémorise sa propre fenêtre : la purge ne peut pas effacer trop tôt une clé
// à longue fenêtre à cause d'un appel à fenêtre courte.
type Bucket = { hits: number[]; windowMs: number };

class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  /** Enregistre une tentative ; renvoie le délai d'attente (s) si la limite est dépassée. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    this.sweep(now);
    const from = now - windowMs;
    const hits = (this.buckets.get(key)?.hits ?? []).filter((t) => t > from);
    if (hits.length >= limit) {
      this.buckets.set(key, { hits, windowMs });
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
    }
    hits.push(now);
    this.buckets.set(key, { hits, windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  // Purge périodique des clés dont la fenêtre est écoulée, pour borner la mémoire.
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      const last = bucket.hits[bucket.hits.length - 1];
      if (last === undefined || last <= now - bucket.windowMs) this.buckets.delete(key);
    }
  }
}

const globalForLimiter = globalThis as unknown as { __rateLimiter?: RateLimiter };
export const limiter: RateLimiter = globalForLimiter.__rateLimiter ?? (globalForLimiter.__rateLimiter = new RateLimiter());

/**
 * IP du client telle que vue par le proxy de confiance. La première valeur de
 * X-Forwarded-For est fournie par le client (falsifiable) : on prend celle ajoutée par
 * le proxy, à `TRUSTED_PROXY_HOPS` positions de la fin (1 par défaut : Nginx, Vercel…).
 * `X-Real-IP` n'est lu que si `TRUST_X_REAL_IP=1` (proxy qui l'écrase systématiquement).
 */
export function clientIp(req: NextRequest): string {
  const real = process.env.TRUST_X_REAL_IP === '1' ? req.headers.get('x-real-ip') : null;
  if (real) return real.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const chain = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
    return chain[Math.max(0, chain.length - hops)] ?? 'unknown';
  }
  return 'unknown';
}

async function hit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const r = readyRedis();
  if (r) {
    try {
      return await redisRateLimitHit(r.cmd, key, limit, windowMs);
    } catch (e) {
      console.error('[rate-limit] Redis indisponible, limite locale', (e as Error).message);
    }
  }
  return limiter.hit(key, limit, windowMs);
}

/** Lève une ApiError 429 si la limite est atteinte. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const res = await hit(key, limit, windowMs);
  if (!res.ok) throw new ApiError(429, 'rate_limited', { retryAfter: res.retryAfterSec });
}

/** Efface le compteur d'une clé (ex. après une connexion réussie). */
export async function resetRateLimit(key: string): Promise<void> {
  limiter.reset(key);
  await readyRedis()?.cmd.del(`rl:${key}`).catch(() => undefined);
}

export { RateLimiter };
