import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrg, type OrgAuth } from '@/lib/guards';
import { publishBranchUpdate } from '@/lib/queue';
import { audit } from '@/lib/audit';
import {
  TICKET_STATUSES,
  canTransition,
  isTerminalStatus,
  transitionEffects,
  type TicketStatus,
} from '@/lib/ticket-status';

const schema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    /** Poste / employé qui prend le client (null pour désassigner). */
    employeeId: z.string().max(64).nullable().optional(),
    /** Rappeler un client déjà appelé : nouvelle annonce TV + notification. */
    action: z.literal('recall').optional(),
  })
  .refine((d) => d.status || d.action || d.employeeId !== undefined, { message: 'empty' });

type Ctx = { params: Promise<{ id: string }> };

async function loadOwnTicket(auth: OrgAuth, id: string) {
  const ticket = await prisma.ticket.findFirst({ where: { id, branch: { orgId: auth.orgId } } });
  if (!ticket) throw new ApiError(404, 'not_found');
  return ticket;
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const ticket = await loadOwnTicket(auth, id);

  if (body.employeeId) {
    const employee = await prisma.employee.findFirst({ where: { id: body.employeeId, branchId: ticket.branchId } });
    if (!employee) throw new ApiError(400, 'employee_not_found');
  }

  const now = new Date();

  // Toutes les écritures sont conditionnées au statut lu : si deux guichets agissent en même
  // temps sur le même ticket, le second reçoit un conflit au lieu d'écraser le premier.
  if (body.action === 'recall') {
    if (ticket.status !== 'called') throw new ApiError(409, 'invalid_transition');
    const res = await prisma.ticket.updateMany({
      where: { id, status: 'called' },
      data: {
        recallCount: { increment: 1 },
        ...(body.employeeId !== undefined && { employeeId: body.employeeId }),
      },
    });
    if (res.count === 0) throw new ApiError(409, 'ticket_conflict');
    await publishBranchUpdate(ticket.branchId);
    return NextResponse.json({ ok: true });
  }

  const from = ticket.status as TicketStatus;
  const to = body.status ?? from;
  if (to !== from && !canTransition(from, to)) {
    throw new ApiError(409, 'invalid_transition', { from, to });
  }

  const { data, visits, noShows } =
    to !== from ? transitionEffects(from, to, ticket, now) : { data: {}, visits: 0, noShows: 0 };

  await prisma.$transaction(async (tx) => {
    const res = await tx.ticket.updateMany({
      where: { id, status: from },
      data: {
        ...data,
        ...(body.employeeId !== undefined && { employeeId: body.employeeId }),
        // Un ticket remis en file repart sans employé assigné.
        ...(to === 'waiting' && body.employeeId === undefined && { employeeId: null }),
      },
    });
    // Levée dans la transaction : rien n'est écrit (ni compteurs de fidélité) en cas de conflit.
    if (res.count === 0) throw new ApiError(409, 'ticket_conflict');
    if (ticket.customerId && (visits || noShows)) {
      await tx.customer.update({
        where: { id: ticket.customerId },
        data: {
          totalVisits: { increment: visits },
          noShowCount: { increment: noShows },
          ...(visits > 0 && { lastVisitAt: now }),
        },
      });
    }
    if (isTerminalStatus(to)) {
      await tx.pushSubscription.deleteMany({ where: { ticketId: id } });
    }
  });

  await publishBranchUpdate(ticket.branchId);
  return NextResponse.json({ ok: true, from, to });
});

// Annulation par le staff.
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  const ticket = await loadOwnTicket(auth, id);
  if (!canTransition(ticket.status, 'cancelled')) throw new ApiError(409, 'invalid_transition');
  const res = await prisma.ticket.updateMany({
    where: { id, status: ticket.status },
    data: { status: 'cancelled', completedAt: new Date() },
  });
  if (res.count === 0) throw new ApiError(409, 'ticket_conflict');
  await prisma.pushSubscription.deleteMany({ where: { ticketId: id } });
  await audit({ action: 'ticket.cancel.staff', actor: auth, branchId: ticket.branchId, targetType: 'ticket', targetId: id });
  await publishBranchUpdate(ticket.branchId);
  return NextResponse.json({ ok: true });
});
