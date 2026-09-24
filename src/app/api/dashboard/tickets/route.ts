import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { requireOwnBranch } from '@/lib/branch';
import { createTicket } from '@/lib/tickets';
import { DEFAULT_TIMEZONE } from '@/lib/time';
import { routing } from '@/i18n/routing';

const schema = z.object({
  branchId: z.string().min(1).max(64),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  serviceId: z.string().max(64).optional().nullable(),
  locale: z.enum(routing.locales).optional(),
});

// Ticket « comptoir » créé par le staff pour un client sans smartphone.
// Fonctionne même file en pause ou hors horaires : c'est le staff qui décide.
export const POST = route(async (req) => {
  const auth = await requireOrg();
  const data = await parseBody(req, schema);
  const branch = await requireOwnBranch(auth, data.branchId);

  let serviceId: string | null = null;
  if (data.serviceId) {
    const service = await prisma.service.findFirst({ where: { id: data.serviceId, branchId: branch.id, active: true } });
    if (!service) throw new ApiError(400, 'invalid_data', { fields: ['serviceId'] });
    serviceId = service.id;
  }

  const ticket = await createTicket({
    branchId: branch.id,
    timeZone: branch.timezone || DEFAULT_TIMEZONE,
    customerName: data.customerName || '—',
    customerPhone: data.customerPhone || null,
    serviceId,
    locale: data.locale,
  });
  return NextResponse.json({ ok: true, number: ticket.number, publicCode: ticket.publicCode }, { status: 201 });
});
