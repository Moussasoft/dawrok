import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { customerTicketsWhere, requireOwnCustomer } from '@/lib/customers';
import { ANONYMIZED_NAME } from '@/lib/retention-rules';
import { TERMINAL_STATUSES } from '@/lib/ticket-status';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

// Droit à l'effacement (loi 09-08) : fiche supprimée, tickets passés anonymisés, commentaires effacés.
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireOrgRole('manager');
  const { id } = await ctx.params;
  const customer = await requireOwnCustomer(auth, id);
  const mine = customerTicketsWhere(customer);

  // Un ticket ou un RDV en cours doit d'abord être terminé ou annulé (la file en a besoin).
  const pending = await prisma.ticket.count({ where: { AND: [mine, { status: { notIn: [...TERMINAL_STATUSES] } }] } });
  if (pending > 0) throw new ApiError(409, 'customer_has_active_ticket');

  const [, tickets] = await prisma.$transaction([
    prisma.feedback.updateMany({ where: { ticket: mine }, data: { comment: null } }),
    prisma.ticket.updateMany({
      where: mine,
      data: { customerName: ANONYMIZED_NAME, customerPhone: null, customerId: null, cancelToken: null },
    }),
    prisma.customer.delete({ where: { id } }),
  ]);
  // Aucune donnée personnelle dans le journal.
  await audit({
    action: 'customer.delete',
    actor: auth,
    branchId: customer.branchId,
    targetType: 'customer',
    targetId: id,
    metadata: { tickets: tickets.count },
  });
  return NextResponse.json({ ok: true, ticketsAnonymized: tickets.count });
});
