import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportError, shouldAlert, stripQuery } from './monitoring';
import { isWeakJwtSecret } from './secrets';

describe('isWeakJwtSecret', () => {
  it('refuse un secret absent, court ou d’exemple', () => {
    expect(isWeakJwtSecret(undefined)).toBe(true);
    expect(isWeakJwtSecret('court')).toBe(true);
    expect(isWeakJwtSecret('change-me-in-production-0123456789abcdef')).toBe(true);
    expect(isWeakJwtSecret('a'.repeat(32))).toBe(false);
  });
});

describe('supervision des erreurs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('retire la query string (jetons) des chemins', () => {
    expect(stripQuery('/reset-password?token=secret')).toBe('/reset-password');
    expect(stripQuery(undefined)).toBeUndefined();
  });

  it('limite les alertes : une même erreur une fois par minute, 20 par minute au total', () => {
    const t = Date.now() - 10 * 60_000; // dans le passé : la minute en cours reste libre pour les autres tests
    expect(shouldAlert('a', t)).toBe(true);
    expect(shouldAlert('a', t + 1000)).toBe(false);
    expect(shouldAlert('a', t + 60_000)).toBe(true);
    let accepted = 0;
    for (let i = 0; i < 30; i++) if (shouldAlert(`k${i}`, t + 61_000)) accepted++;
    expect(accepted).toBe(19); // « a » compte déjà dans cette minute
  });

  it('journalise en JSON en production et alerte le webhook sans query string ni pile', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ERROR_WEBHOOK_URL', 'https://hooks.example.test/x');
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportError(new Error(`Base injoignable ${Math.random()}`), { source: 'api', method: 'POST', path: '/api/auth/reset-password?token=abc' });

    const line = JSON.parse(log.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: 'error', source: 'api', method: 'POST', path: '/api/auth/reset-password' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.example.test/x');
    const body = JSON.parse(init.body as string);
    expect(body.text).toContain('Base injoignable');
    expect(body.content).toBe(body.text);
    expect(JSON.stringify(body)).not.toContain('token=abc');
    expect(body.error.stack).toBeUndefined();
  });

  it('sans webhook : journal seulement', () => {
    vi.stubEnv('ERROR_WEBHOOK_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    reportError('boom', { source: 'render' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
