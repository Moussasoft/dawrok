import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

async function findEmployee(id: string, orgId: string) {
  return prisma.employee.findFirst({ where: { id, branch: { orgId } } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const emp = await findEmployee(id, session.orgId);
  if (!emp) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const updated = await prisma.employee.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.orgId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const emp = await findEmployee(id, session.orgId);
  if (!emp) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  await prisma.employee.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
