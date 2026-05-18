import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(
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

  const employee = await prisma.employee.create({ data: { branchId: id, name: parsed.data.name } });
  return NextResponse.json(employee, { status: 201 });
}
