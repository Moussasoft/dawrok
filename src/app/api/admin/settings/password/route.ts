import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 });

  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash: hash } });

  return NextResponse.json({ ok: true });
}
