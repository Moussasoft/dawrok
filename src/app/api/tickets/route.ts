import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getNextTicketNumber, publishBranchUpdate } from '@/lib/queue';

const schema = z.object({
  qrToken: z.string().min(4),
  customerName: z.string().min(1).max(80),
  customerPhone: z.string().max(30).optional().nullable(),
  serviceId: z.string().optional().nullable(),
});

// Public endpoint — client scans QR and submits ticket
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const branch = await prisma.branch.findUnique({
    where: { qrToken: parsed.data.qrToken },
    include: { services: { where: { active: true } }, organization: true },
  });
  if (!branch || !branch.active) {
    return NextResponse.json({ error: 'Point de service introuvable' }, { status: 404 });
  }
  if (branch.organization.suspended) {
    return NextResponse.json({ error: 'Service temporairement indisponible' }, { status: 403 });
  }
  // Branch closed/paused
  if (branch.closedUntil && branch.closedUntil.getTime() > Date.now()) {
    return NextResponse.json(
      {
        error: 'File temporairement fermée',
        reason: branch.closureReason ?? null,
        reopenAt: branch.closedUntil.toISOString(),
      },
      { status: 423 }
    );
  }

  // Optional simple anti-spam: limit identical phone to 1 active ticket
  if (parsed.data.customerPhone) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dup = await prisma.ticket.findFirst({
      where: {
        branchId: branch.id,
        customerPhone: parsed.data.customerPhone,
        status: { in: ['waiting', 'called', 'in_progress'] },
        createdAt: { gte: startOfDay },
      },
    });
    if (dup) {
      return NextResponse.json({ ok: true, publicCode: dup.publicCode, duplicate: true });
    }
  }

  // Validate service belongs to branch
  let serviceId: string | null = null;
  if (parsed.data.serviceId) {
    const valid = branch.services.find((s) => s.id === parsed.data.serviceId);
    if (valid) serviceId = valid.id;
  }

  const number = await getNextTicketNumber(branch.id);

  // Upsert customer if phone provided (fidelity tracking)
  let customerId: string | null = null;
  const trimmedPhone = parsed.data.customerPhone?.trim() || null;
  const trimmedName = parsed.data.customerName.trim();
  if (trimmedPhone) {
    const customer = await prisma.customer.upsert({
      where: { branchId_phone: { branchId: branch.id, phone: trimmedPhone } },
      update: { name: trimmedName },
      create: { branchId: branch.id, phone: trimmedPhone, name: trimmedName },
    });
    customerId = customer.id;
  }

  const cancelToken = crypto.randomBytes(16).toString('hex');
  const ticket = await prisma.ticket.create({
    data: {
      branchId: branch.id,
      number,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      customerId,
      serviceId,
      cancelToken,
    },
  });

  await publishBranchUpdate(branch.id);
  return NextResponse.json({ ok: true, publicCode: ticket.publicCode, number: ticket.number });
}
