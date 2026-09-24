// Notifications Web Push (VAPID). Désactivées proprement si les clés ne sont pas configurées.
import webpush from 'web-push';
import { createTranslator } from 'next-intl';
import { prisma } from './db';
import type { DashboardSnapshot } from './queue-types';
import type { PushKind } from './queue-logic';
import { MESSAGES, toAppLocale } from '@/i18n/messages';
import { localizedUrl } from './urls';
import { claimOnce } from './redis';

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@daourak.app', publicKey, privateKey);
    configured = true;
  } catch (e) {
    console.error('[push] clés VAPID invalides', e);
    configured = false;
  }
  return configured;
}

export function ticketUrl(publicCode: string, locale: string): string {
  return localizedUrl(`/t/${publicCode}`, locale);
}

export async function notifyTransitions(
  snap: DashboardSnapshot,
  transitions: { ticketId: string; kind: PushKind }[]
): Promise<void> {
  if (!isPushConfigured() || !transitions.length) return;
  const byTicket = new Map(snap.tickets.map((t) => [t.id, t]));
  // Plusieurs instances peuvent détecter la même transition : une seule envoie la notification.
  const claimed: typeof transitions = [];
  for (const tr of transitions) {
    const t = byTicket.get(tr.ticketId);
    if (await claimOnce(`push:${tr.ticketId}:${tr.kind}:${t?.calledAt ?? ''}:${t?.recallCount ?? 0}`, 15 * 60_000)) claimed.push(tr);
  }
  if (!claimed.length) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { ticketId: { in: claimed.map((t) => t.ticketId) } },
  });
  if (!subs.length) return;

  const kindByTicket = new Map(claimed.map((t) => [t.ticketId, t.kind]));

  await Promise.all(
    subs.map(async (sub) => {
      const ticket = byTicket.get(sub.ticketId);
      const kind = kindByTicket.get(sub.ticketId);
      if (!ticket || !kind) return;
      const locale = toAppLocale(sub.locale);
      const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'push' });
      const number = String(ticket.number).padStart(3, '0');
      const where = ticket.employeeName ?? snap.branchName;
      const payload =
        kind === 'called'
          ? { title: t('calledTitle', { number }), body: t('calledBody', { where }) }
          : kind === 'soon'
            ? { title: t('soonTitle'), body: t('soonBody', { count: ticket.position, branch: snap.branchName }) }
            : { title: t('appointmentTitle'), body: t('appointmentBody', { branch: snap.branchName }) };
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...payload, kind, tag: `ticket-${ticket.publicCode}`, url: ticketUrl(ticket.publicCode, locale) }),
          { TTL: 15 * 60, urgency: kind === 'called' ? 'high' : 'normal' }
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          console.error('[push] envoi échoué', status ?? e);
        }
      }
    })
  );
}
