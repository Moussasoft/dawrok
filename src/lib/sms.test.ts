import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveChannel, sendText, smsProviders } from './sms';

const ENV_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'TWILIO_MESSAGING_SERVICE_SID', 'TWILIO_WHATSAPP_FROM', 'TWILIO_API_BASE'];

describe('sms (Twilio)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
  });

  it('ne fait rien sans configuration', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(smsProviders()).toEqual({ sms: false, whatsapp: false });
    expect(resolveChannel('sms')).toBeNull();
    expect(await sendText('+212612345678', 'Bonjour', 'sms')).toEqual({ ok: false, error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie un SMS avec authentification et numéro expéditeur', async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret', TWILIO_FROM: '+15550001111' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: 'SM1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendText('+212612345678', 'C’est votre tour', 'sms')).toEqual({ ok: true, id: 'SM1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('AC123:secret').toString('base64')}`);
    const body = init.body as URLSearchParams;
    expect(body.get('To')).toBe('+212612345678');
    expect(body.get('From')).toBe('+15550001111');
    expect(body.get('Body')).toBe('C’est votre tour');
  });

  it('préfixe les numéros WhatsApp et se rabat sur le SMS si WhatsApp n’est pas configuré', async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret', TWILIO_WHATSAPP_FROM: '+15550002222' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: 'SM2' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(resolveChannel('whatsapp')).toBe('whatsapp');
    await sendText('+212612345678', 'Hi', 'whatsapp');
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get('To')).toBe('whatsapp:+212612345678');
    expect(body.get('From')).toBe('whatsapp:+15550002222');

    delete process.env.TWILIO_WHATSAPP_FROM;
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG1';
    expect(resolveChannel('whatsapp')).toBe('sms');
  });

  it('remonte l’erreur du fournisseur', async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret', TWILIO_FROM: '+15550001111' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 21211, message: 'Invalid To' }), { status: 400 })));
    expect(await sendText('+212612345678', 'x', 'sms')).toEqual({ ok: false, error: '400 21211 Invalid To' });
  });
});
