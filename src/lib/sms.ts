// Envoi de SMS et de messages WhatsApp via l'API REST de Twilio (sans SDK : un seul appel HTTP).
// Sans fournisseur configuré, rien n'est envoyé (le message est affiché dans la console en développement).
import { maskPhone } from './phone';

export type SmsChannel = 'sms' | 'whatsapp';
export const SMS_CHANNELS = ['sms', 'whatsapp'] as const;

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

function env() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM,
    messagingService: process.env.TWILIO_MESSAGING_SERVICE_SID,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
    // Surchargeable pour les tests (serveur factice).
    base: (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/$/, ''),
  };
}

/** Canaux utilisables avec la configuration actuelle. */
export function smsProviders(): Record<SmsChannel, boolean> {
  const e = env();
  const account = !!(e.sid && e.token);
  return { sms: account && !!(e.from || e.messagingService), whatsapp: account && !!e.whatsappFrom };
}

/** Canal effectif : WhatsApp demandé mais non configuré → SMS s'il l'est. */
export function resolveChannel(wanted: string): SmsChannel | null {
  const providers = smsProviders();
  if (wanted === 'whatsapp' && providers.whatsapp) return 'whatsapp';
  return providers.sms ? 'sms' : providers.whatsapp ? 'whatsapp' : null;
}

export async function sendText(to: string, body: string, channel: SmsChannel): Promise<SendResult> {
  const e = env();
  if (!smsProviders()[channel]) {
    if (process.env.NODE_ENV !== 'production') console.info(`[sms] (${channel} non configuré) → ${maskPhone(to)} : ${body}`);
    return { ok: false, error: 'not_configured' };
  }
  const form = new URLSearchParams({ To: channel === 'whatsapp' ? `whatsapp:${to}` : to, Body: body });
  if (channel === 'whatsapp') form.set('From', `whatsapp:${e.whatsappFrom}`);
  else if (e.messagingService) form.set('MessagingServiceSid', e.messagingService);
  else form.set('From', e.from!);

  try {
    const res = await fetch(`${e.base}/2010-04-01/Accounts/${encodeURIComponent(e.sid!)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${e.sid}:${e.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
    if (!res.ok || !data.sid) return { ok: false, error: `${res.status}${data.code ? ` ${data.code}` : ''} ${data.message ?? ''}`.trim() };
    return { ok: true, id: data.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}
