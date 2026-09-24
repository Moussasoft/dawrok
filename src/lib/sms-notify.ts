// SMS / WhatsApp aux clients qui l'ont demandé : « bientôt votre tour » puis premier appel.
// Quota mensuel de l'offre, dédoublonnage en base (plusieurs instances, rappels), journal sans numéro.
import { createTranslator } from 'next-intl';
import { prisma } from './db';
import type { DashboardSnapshot } from './queue-types';
import type { PushKind } from './queue-logic';
import { getPlanLimits } from './plans';
import { isTextable, toE164 } from './phone';
import { resolveChannel, sendText, type SmsChannel } from './sms';
import { localizedUrl } from './urls';
import { ApiError } from './api';
import { MESSAGES, toAppLocale } from '@/i18n/messages';

type SmsKind = 'soon' | 'called';

/** Période du quota : mois civil (UTC). */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Messages envoyés ce mois-ci par l'organisation. */
export function smsUsage(orgId: string, now = new Date()): Promise<number> {
  return prisma.smsMessage.count({ where: { orgId, status: 'sent', createdAt: { gte: monthStart(now) } } });
}

export async function notifySmsTransitions(snap: DashboardSnapshot, transitions: { ticketId: string; kind: PushKind }[]): Promise<void> {
  const wanted = new Map<string, SmsKind>();
  for (const t of transitions) if (t.kind === 'soon' || t.kind === 'called') wanted.set(t.ticketId, t.kind);
  if (!wanted.size) return;

  const tickets = await prisma.ticket.findMany({
    where: { id: { in: [...wanted.keys()] }, notifySms: true, customerPhone: { not: null } },
    select: { id: true, number: true, publicCode: true, customerPhone: true, locale: true, smsCalledAt: true },
  });
  if (!tickets.length) return;
  const org = await prisma.organization.findFirst({
    where: { branches: { some: { id: snap.branchId } } },
    select: { id: true, name: true, plan: true, smsEnabled: true, smsChannel: true },
  });
  if (!org?.smsEnabled) return;
  const channel = resolveChannel(org.smsChannel);
  if (!channel) return;
  const { smsQuota } = await getPlanLimits(org.plan);
  let used = await smsUsage(org.id);
  const live = new Map(snap.tickets.map((t) => [t.id, t]));

  // Un par un : le quota est vérifié avant chaque envoi.
  for (const ticket of tickets) {
    const kind = wanted.get(ticket.id)!;
    const current = live.get(ticket.id);
    const to = toE164(ticket.customerPhone);
    // Déjà appelé puis remis en file : « bientôt votre tour » n'aurait plus de sens.
    if (!current || !isTextable(to) || (kind === 'soon' && ticket.smsCalledAt)) continue;
    if (used >= smsQuota) {
      console.warn(`[sms] quota mensuel atteint (${smsQuota}) pour l'organisation ${org.id}`);
      return;
    }
    // Réservation atomique : un seul message de chaque type par ticket.
    const now = new Date();
    const claimed =
      kind === 'called'
        ? await prisma.ticket.updateMany({ where: { id: ticket.id, smsCalledAt: null }, data: { smsCalledAt: now } })
        : await prisma.ticket.updateMany({ where: { id: ticket.id, smsSoonAt: null }, data: { smsSoonAt: now } });
    if (claimed.count === 0) continue;

    const locale = toAppLocale(ticket.locale);
    const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'sms' });
    const number = String(ticket.number).padStart(3, '0');
    const body =
      kind === 'called'
        ? t('called', { org: org.name, number, where: current.employeeName ?? snap.branchName })
        : t('soon', { org: org.name, number, count: Math.max(0, current.position), url: localizedUrl(`/t/${ticket.publicCode}`, locale) });
    const result = await sendText(to, body, channel);
    await prisma.smsMessage.create({
      data: {
        orgId: org.id,
        ticketId: ticket.id,
        channel,
        kind,
        status: result.ok ? 'sent' : 'failed',
        providerId: result.ok ? result.id : null,
        error: result.ok ? null : result.error.slice(0, 300),
      },
    });
    if (result.ok) used++;
    else console.error('[sms] envoi échoué :', result.error);
  }
}

/** Canal proposé aux clients de l'organisation (null : pas d'offre SMS). */
export async function smsOfferFor(org: { smsEnabled: boolean; smsChannel: string; plan: string }): Promise<SmsChannel | null> {
  if (!org.smsEnabled) return null;
  const { smsQuota } = await getPlanLimits(org.plan);
  return smsQuota > 0 ? resolveChannel(org.smsChannel) : null;
}

/**
 * Consentement SMS demandé à la prise de ticket : refusé (400) si le numéro ne peut pas recevoir
 * de SMS ; ignoré si l'organisation ne propose pas (ou plus) l'offre.
 */
export async function wantsSms(org: { smsEnabled: boolean; smsChannel: string; plan: string }, phone: string | null): Promise<boolean> {
  if (!isTextable(toE164(phone))) throw new ApiError(400, 'invalid_phone');
  return (await smsOfferFor(org)) !== null;
}
