// Création de tickets (QR public et comptoir) : fidélité client + numérotation atomique.
import crypto from 'crypto';
import { prisma } from './db';
import { nextTicketNumber, publishBranchUpdate } from './queue';

export async function upsertCustomer(branchId: string, phone: string | null, name: string): Promise<string | null> {
  if (!phone) return null;
  const customer = await prisma.customer.upsert({
    where: { branchId_phone: { branchId, phone } },
    update: { name },
    create: { branchId, phone, name },
  });
  return customer.id;
}

export async function createTicket(input: {
  branchId: string;
  timeZone: string;
  customerName: string;
  customerPhone: string | null;
  serviceId: string | null;
  employeeId?: string | null;
  /** Langue du client (SMS, e-mails) ; défaut : langue par défaut de l'app. */
  locale?: string;
}) {
  const customerId = await upsertCustomer(input.branchId, input.customerPhone, input.customerName);
  const number = await nextTicketNumber(input.branchId, input.timeZone);
  const ticket = await prisma.ticket.create({
    data: {
      branchId: input.branchId,
      number,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerId,
      serviceId: input.serviceId,
      employeeId: input.employeeId ?? null,
      cancelToken: crypto.randomBytes(16).toString('hex'),
      ...(input.locale ? { locale: input.locale } : {}),
    },
  });
  await publishBranchUpdate(input.branchId);
  return ticket;
}
