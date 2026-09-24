import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { assertCanAdd } from '@/lib/plans';
import { audit } from '@/lib/audit';

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(200).nullable().optional(),
});

// Nouvelle succursale (dans la limite du plan). Elle démarre avec un poste au nom du compte.
export const POST = route(async (req) => {
  const auth = await requireOrgRole('manager');
  const data = await parseBody(req, schema);
  await assertCanAdd(auth.orgId, 'branches');

  const first = await prisma.branch.findFirst({ where: { orgId: auth.orgId }, orderBy: { createdAt: 'asc' } });
  const branch = await prisma.branch.create({
    data: {
      orgId: auth.orgId,
      name: data.name,
      address: data.address || null,
      // Reprend les réglages de la première agence pour démarrer vite.
      timezone: first?.timezone,
      openHours: first?.openHours,
      allowBooking: first?.allowBooking,
      bookingSlotMin: first?.bookingSlotMin,
    },
  });
  await audit({ action: 'branch.create', actor: auth, branchId: branch.id, targetType: 'branch', targetId: branch.id });
  return NextResponse.json(branch, { status: 201 });
});
