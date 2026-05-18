import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  sector: z.string().min(1).max(50).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const org = await prisma.organization.update({
    where: { id: session.orgId },
    data: parsed.data,
  });

  return NextResponse.json(org);
}
