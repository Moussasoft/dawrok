import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(200).nullable().optional(),
  timezone: z.string().min(1).max(50).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const branch = await prisma.branch.findFirst({ where: { id, orgId: session.orgId } });
  if (!branch) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const updated = await prisma.branch.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}
