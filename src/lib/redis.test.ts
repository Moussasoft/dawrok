import { afterEach, describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { claimOnce, redisRateLimitHit, setRedisClientsForTesting } from './redis';
import { enforceRateLimit } from './rate-limit';
import { ApiError } from './api';

const MIN = 60_000;
const T0 = 1_790_000_000_000;

/** ioredis-mock n'expose pas `status` : on simule une connexion établie. */
const ready = <T extends object>(client: T): T => Object.assign(client, { status: 'ready' });

function mockClients() {
  const cmd = ready(new RedisMock() as unknown as Redis);
  return { cmd, sub: ready((cmd as unknown as { duplicate(): Redis }).duplicate()) };
}

afterEach(() => setRedisClientsForTesting(null));

describe('limitation de débit Redis (script Lua)', () => {
  it('fenêtre glissante identique au limiteur en mémoire', async () => {
    const { cmd } = mockClients();
    const key = `k:${Math.random()}`;
    expect(await redisRateLimitHit(cmd, key, 2, MIN, T0)).toEqual({ ok: true, retryAfterSec: 0 });
    expect((await redisRateLimitHit(cmd, key, 2, MIN, T0 + 10_000)).ok).toBe(true);
    // Le plus ancien essai (T0) sort de la fenêtre dans 55 s.
    expect(await redisRateLimitHit(cmd, key, 2, MIN, T0 + 5_000 + 10_000)).toEqual({ ok: false, retryAfterSec: 45 });
    // Un essai vieux d'exactement windowMs ne compte plus.
    expect((await redisRateLimitHit(cmd, key, 2, MIN, T0 + MIN)).ok).toBe(true);
  });

  it('les essais refusés ne prolongent pas le blocage', async () => {
    const { cmd } = mockClients();
    const key = `k:${Math.random()}`;
    await redisRateLimitHit(cmd, key, 1, 10_000, T0);
    expect(await redisRateLimitHit(cmd, key, 1, 10_000, T0 + 5_000)).toEqual({ ok: false, retryAfterSec: 5 });
    expect((await redisRateLimitHit(cmd, key, 1, 10_000, T0 + 10_000)).ok).toBe(true);
  });

  it('partage le compteur entre instances (deux connexions)', async () => {
    const a = mockClients();
    const b = { cmd: (a.cmd as unknown as { duplicate(): Redis }).duplicate() };
    const key = `k:${Math.random()}`;
    await redisRateLimitHit(a.cmd, key, 1, MIN, T0);
    expect((await redisRateLimitHit(b.cmd, key, 1, MIN, T0 + 1)).ok).toBe(false);
  });

  it('enforceRateLimit passe par Redis quand il est configuré', async () => {
    const clients = mockClients();
    setRedisClientsForTesting(clients);
    const key = `k:${Math.random()}`;
    await enforceRateLimit(key, 1, MIN);
    expect(await clients.cmd.zcard(`rl:${key}`)).toBe(1);
    await expect(enforceRateLimit(key, 1, MIN)).rejects.toBeInstanceOf(ApiError);
  });

  it('se replie en mémoire si Redis échoue', async () => {
    const broken = ready({ defineCommand: () => undefined, daourakRateLimit: () => Promise.reject(new Error('down')) });
    setRedisClientsForTesting({ cmd: broken as unknown as Redis, sub: broken as unknown as Redis });
    const key = `k:${Math.random()}`;
    await expect(enforceRateLimit(key, 1, MIN)).resolves.toBeUndefined();
    await expect(enforceRateLimit(key, 1, MIN)).rejects.toMatchObject({ status: 429 });
  });
});

describe('claimOnce', () => {
  it('en mémoire : un seul gagnant pendant la durée', async () => {
    const key = `c:${Math.random()}`;
    expect(await claimOnce(key, MIN)).toBe(true);
    expect(await claimOnce(key, MIN)).toBe(false);
  });

  it('connexion Redis pas encore prête : repli immédiat en mémoire', async () => {
    const cmd = new RedisMock() as unknown as Redis; // status absent ≠ « ready »
    setRedisClientsForTesting({ cmd, sub: cmd });
    const key = `c:${Math.random()}`;
    expect(await claimOnce(key, MIN)).toBe(true);
    expect(await cmd.exists(`claim:${key}`)).toBe(0);
  });

  it('avec Redis : un seul gagnant toutes instances confondues', async () => {
    const clients = mockClients();
    setRedisClientsForTesting(clients);
    const key = `c:${Math.random()}`;
    const results = await Promise.all([claimOnce(key, MIN), claimOnce(key, MIN), claimOnce(key, MIN)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await clients.cmd.pttl(`claim:${key}`)).toBeGreaterThan(0);
  });
});
