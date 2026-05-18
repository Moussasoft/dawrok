import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const { id } = await params;

  // Cannot revoke yourself
  if (id === session.userId) {
    return NextResponse.json({ error: 'Impossible de révoquer votre propre compte' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || !target.isSuperadmin) {
    return NextResponse.json({ error: 'Superadmin introuvable' }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
