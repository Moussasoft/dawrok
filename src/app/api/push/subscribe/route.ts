import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { isPushConfigured } from '@/lib/push';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { routing } from '@/i18n/routing';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

const postSchema = z.object({
  publicCode: z.string().min(8).max(64),
  subscription: subscriptionSchema,
  locale: z.enum(routing.locales).default(routing.defaultLocale),
});

// Le client s'abonne aux notifications de SON ticket (le publicCode fait office de clé).
export const POST = route(async (req) => {
  enforceRateLimit(`push:ip:${clientIp(req)}`, 20, 10 * 60_000);
  if (!isPushConfigured()) throw new ApiError(503, 'push_not_configured');
  const { publicCode, subscription, locale } = await parseBody(req, postSchema);

  const ticket = await prisma.ticket.findUnique({ where: { publicCode }, select: { id: true, status: true } });
  if (!ticket) throw new ApiError(404, 'not_found');
  if (!['scheduled', 'waiting', 'called'].includes(ticket.status)) throw new ApiError(409, 'ticket_not_active');

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { ticketId: ticket.id, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, locale },
    create: {
      ticketId: ticket.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      locale,
    },
  });
  return NextResponse.json({ ok: true });
});

const deleteSchema = z.object({ endpoint: z.string().url().max(1000) });

export const DELETE = route(async (req) => {
  const { endpoint } = await parseBody(req, deleteSchema);
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
});
