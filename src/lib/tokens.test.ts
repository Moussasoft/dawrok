import { describe, expect, it } from 'vitest';
import { createToken, hashToken, isSessionStale } from './tokens';

describe('jetons à usage unique', () => {
  it('produit un jeton aléatoire, sûr pour une URL, et son hash déterministe', () => {
    const a = createToken();
    const b = createToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.hash).not.toContain(a.token);
  });
});

describe('isSessionStale', () => {
  const changedAt = new Date('2026-09-24T10:00:00.500Z');
  it('accepte une session sans changement de mot de passe', () => {
    expect(isSessionStale(1_700_000_000, null)).toBe(false);
    expect(isSessionStale(undefined, changedAt)).toBe(false);
  });
  it('révoque une session émise avant le changement', () => {
    expect(isSessionStale(Date.parse('2026-09-24T09:59:00Z') / 1000, changedAt)).toBe(true);
  });
  it('garde la session émise juste après (iat arrondi à la seconde)', () => {
    expect(isSessionStale(Math.floor(changedAt.getTime() / 1000), changedAt)).toBe(false);
  });
});
