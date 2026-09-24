import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { customerTicketsWhere, requireOwnCustomer } from '@/lib/customers';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// Droit d'accès (loi 09-08) : toutes les données d'un client, dans un fichier JSON à lui remettre.
export const GET = route<Ctx>(async (_req, ctx) => {
  const auth = await requireOrgRole('manager');
  const { id } = await ctx.params;
  const customer = await requireOwnCustomer(auth, id);
  const tickets = await prisma.ticket.findMany({
    where: customerTicketsWhere(customer),
    orderBy: { createdAt: 'asc' },
    select: {
      number: true,
      kind: true,
      status: true,
      customerName: true,
      customerPhone: true,
      locale: true,
      createdAt: true,
      scheduledFor: true,
      calledAt: true,
      completedAt: true,
      service: { select: { name: true } },
      employee: { select: { name: true } },
      feedback: { select: { rating: true, comment: true, createdAt: true } },
    },
  });

  const body = {
    exportedAt: new Date().toISOString(),
    controller: { organization: customer.branch.organization.name, branch: customer.branch.name },
    customer: {
      name: customer.name,
      phone: customer.phone,
      totalVisits: customer.totalVisits,
      noShowCount: customer.noShowCount,
      lastVisitAt: customer.lastVisitAt,
      notes: customer.notes,
      createdAt: customer.createdAt,
    },
    tickets: tickets.map(({ service, employee, ...t }) => ({ ...t, service: service?.name ?? null, employee: employee?.name ?? null })),
  };
  await audit({ action: 'customer.export', actor: auth, branchId: customer.branchId, targetType: 'customer', targetId: id });
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="client-${id.slice(-8)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
