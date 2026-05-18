import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avgDurationMin: z.number().int().min(1).max(480).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
});

async function findService(id: string, orgId: string) {
  return prisma.service.findFirst({ where: { id, branch: { orgId } } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const svc = await findService(id, session.orgId);
  if (!svc) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const updated = await prisma.service.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const svc = await findService(id, session.orgId);
  if (!svc) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  await prisma.service.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
