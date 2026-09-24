import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { ApiError } from './api';
import { RateLimiter, clientIp, enforceRateLimit, resetRateLimit } from './rate-limit';

const MIN = 60_000;
const T0 = Date.now();

describe('RateLimiter', () => {
  it('accepte jusqu’à la limite puis refuse', () => {
    const rl = new RateLimiter();
    expect(rl.hit('k', 3, MIN, T0)).toEqual({ ok: true, retryAfterSec: 0 });
    expect(rl.hit('k', 3, MIN, T0 + 1000).ok).toBe(true);
    expect(rl.hit('k', 3, MIN, T0 + 2000).ok).toBe(true);
    // Le plus ancien essai (T0) sort de la fenêtre dans 57 s.
    expect(rl.hit('k', 3, MIN, T0 + 3000)).toEqual({ ok: false, retryAfterSec: 57 });
  });

  it('fait glisser la fenêtre : un essai vieux d’exactement windowMs ne compte plus', () => {
    const rl = new RateLimiter();
    rl.hit('k', 2, MIN, T0);
    rl.hit('k', 2, MIN, T0 + 10_000);
    expect(rl.hit('k', 2, MIN, T0 + MIN - 1).ok).toBe(false);
    expect(rl.hit('k', 2, MIN, T0 + MIN).ok).toBe(true); // T0 est sorti de la fenêtre
    // Fenêtre pleine à nouveau (T0+10 s et T0+60 s) : libération à T0+70 s.
    expect(rl.hit('k', 2, MIN, T0 + MIN + 1).retryAfterSec).toBe(10);
  });

  it('n’enregistre pas les essais refusés (le blocage ne se prolonge pas)', () => {
    const rl = new RateLimiter();
    rl.hit('k', 1, 10_000, T0);
    expect(rl.hit('k', 1, 10_000, T0 + 5000)).toEqual({ ok: false, retryAfterSec: 5 });
    expect(rl.hit('k', 1, 10_000, T0 + 9000)).toEqual({ ok: false, retryAfterSec: 1 });
    expect(rl.hit('k', 1, 10_000, T0 + 10_000).ok).toBe(true);
  });

  it('arrondit retryAfterSec au supérieur, avec un minimum d’1 s, et le délai suffit', () => {
    const rl = new RateLimiter();
    rl.hit('k', 1, MIN, T0);
    const blocked = rl.hit('k', 1, MIN, T0 + MIN - 1);
    expect(blocked).toEqual({ ok: false, retryAfterSec: 1 });
    const rl2 = new RateLimiter();
    rl2.hit('k', 1, MIN, T0);
    const { retryAfterSec } = rl2.hit('k', 1, MIN, T0 + 12_345);
    expect(retryAfterSec).toBe(48); // 47,655 s → 48
    expect(rl2.hit('k', 1, MIN, T0 + 12_345 + retryAfterSec * 1000).ok).toBe(true);
  });

  it('isole les clés', () => {
    const rl = new RateLimiter();
    rl.hit('ip:1', 1, MIN, T0);
    expect(rl.hit('ip:1', 1, MIN, T0 + 1).ok).toBe(false);
    expect(rl.hit('ip:2', 1, MIN, T0 + 1).ok).toBe(true);
  });

  it('reset() efface le compteur d’une clé', () => {
    const rl = new RateLimiter();
    rl.hit('k', 1, MIN, T0);
    rl.hit('other', 1, MIN, T0);
    expect(rl.hit('k', 1, MIN, T0 + 1).ok).toBe(false);
    rl.reset('k');
    expect(rl.hit('k', 1, MIN, T0 + 2).ok).toBe(true);
    expect(rl.hit('other', 1, MIN, T0 + 2).ok).toBe(false);
  });

  // Non-régression : la purge utilisait la fenêtre de l'appel qui la déclenchait, et une clé
  // à fenêtre longue (24 h) était effacée par un appel à fenêtre courte.
  it('la purge n’efface pas une clé dont la fenêtre dépasse 1 h', () => {
    const rl = new RateLimiter();
    const DAY = 24 * 60 * MIN;
    expect(rl.hit('signup', 1, DAY, T0).ok).toBe(true);
    rl.hit('slots', 100, MIN, T0 + 2 * 60 * MIN); // déclenche la purge
    expect(rl.hit('signup', 1, DAY, T0 + 2 * 60 * MIN + 1).ok).toBe(false);
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as NextRequest;

  it('ignore x-real-ip sauf si TRUST_X_REAL_IP=1', () => {
    expect(clientIp(req({ 'x-real-ip': 'spoofed', 'x-forwarded-for': '41.250.1.2' }))).toBe('41.250.1.2');
    process.env.TRUST_X_REAL_IP = '1';
    try {
      expect(clientIp(req({ 'x-real-ip': '41.250.3.4', 'x-forwarded-for': '1.1.1.1' }))).toBe('41.250.3.4');
    } finally {
      delete process.env.TRUST_X_REAL_IP;
    }
    expect(clientIp(req({}))).toBe('unknown');
  });

  it('prend l’adresse ajoutée par le proxy de confiance, pas celle fournie par le client', () => {
    // Le client envoie « spoofed » ; le proxy ajoute l'IP réelle en fin de chaîne.
    expect(clientIp(req({ 'x-forwarded-for': 'spoofed, 41.250.1.2' }))).toBe('41.250.1.2');
    expect(clientIp(req({ 'x-forwarded-for': '41.250.1.2' }))).toBe('41.250.1.2');
  });

  it('remonte d’autant de proxys que TRUSTED_PROXY_HOPS', () => {
    const previous = process.env.TRUSTED_PROXY_HOPS;
    process.env.TRUSTED_PROXY_HOPS = '2';
    try {
      // CDN puis répartiteur de charge : l'IP du client est l'avant-dernière.
      expect(clientIp(req({ 'x-forwarded-for': 'spoofed, 41.250.1.2, 10.0.0.1' }))).toBe('41.250.1.2');
    } finally {
      if (previous === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = previous;
    }
  });
});

describe('enforceRateLimit', () => {
  it('lève une ApiError 429 avec retryAfter une fois la limite atteinte', async () => {
    const key = `test:${T0}:${Math.random()}`;
    await expect(enforceRateLimit(key, 1, MIN)).resolves.toBeUndefined();
    const error = await enforceRateLimit(key, 1, MIN).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'rate_limited' });
    const retryAfter = (error as ApiError).extra?.retryAfter as number;
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('resetRateLimit libère la clé', async () => {
    const key = `test:reset:${Math.random()}`;
    await enforceRateLimit(key, 1, MIN);
    await resetRateLimit(key);
    await expect(enforceRateLimit(key, 1, MIN)).resolves.toBeUndefined();
  });
});
