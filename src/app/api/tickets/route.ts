import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { createTicket } from '@/lib/tickets';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { isOpenAt, nextOpening, parseOpenHours } from '@/lib/opening-hours';
import { DEFAULT_TIMEZONE } from '@/lib/time';
import { routing } from '@/i18n/routing';

const schema = z.object({
  qrToken: z.string().min(4).max(64),
  customerName: z.string().trim().min(1).max(80),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  serviceId: z.string().max(64).optional().nullable(),
  locale: z.enum(routing.locales).optional(),
});

// Endpoint public — le client scanne le QR et prend son ticket.
export const POST = route(async (req) => {
  const ip = clientIp(req);
  // Limites larges : tous les clients d'un Wi-Fi d'agence partagent la même IP publique.
  enforceRateLimit(`ticket:ip:${ip}`, 40, 10 * 60_000);
  const data = await parseBody(req, schema);
  enforceRateLimit(`ticket:branch:${data.qrToken}:ip:${ip}`, 25, 10 * 60_000);

  const branch = await prisma.branch.findUnique({
    where: { qrToken: data.qrToken },
    include: { services: { where: { active: true } }, organization: true },
  });
  if (!branch || !branch.active) throw new ApiError(404, 'branch_not_found');
  if (branch.organization.suspended) throw new ApiError(403, 'service_unavailable');

  const now = new Date();
  if (branch.closedUntil && branch.closedUntil > now) {
    throw new ApiError(423, 'queue_closed', {
      reason: branch.closureReason ?? null,
      reopenAt: branch.closedUntil.toISOString(),
    });
  }
  const timeZone = branch.timezone || DEFAULT_TIMEZONE;
  const hours = parseOpenHours(branch.openHours);
  if (!isOpenAt(hours, timeZone, now)) {
    throw new ApiError(423, 'branch_closed_hours', { nextOpening: nextOpening(hours, timeZone, now) });
  }

  // Pas d'anti-doublon par téléphone : renvoyer le ticket existant d'un numéro donnait
  // son code (donc le prénom et l'annulation) à quiconque connaissait ce numéro.
  // Le navigateur du client mémorise son propre ticket pour le retrouver.
  const phone = data.customerPhone || null;

  const serviceId = branch.services.some((s) => s.id === data.serviceId)
    ? data.serviceId!
    : branch.services.length === 1
      ? branch.services[0].id
      : null;

  const ticket = await createTicket({
    branchId: branch.id,
    timeZone,
    customerName: data.customerName,
    customerPhone: phone,
    serviceId,
    locale: data.locale,
  });
  return NextResponse.json({ ok: true, publicCode: ticket.publicCode, number: ticket.number });
});
