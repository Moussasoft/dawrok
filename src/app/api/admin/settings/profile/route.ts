import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, createSession, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const { name, email } = parsed.data;
  if (!name && !email) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });

  if (email && email !== session.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { ...(name && { name }), ...(email && { email }) },
  });

  // Refresh session with updated name/email
  const token = await createSession({
    userId: updated.id,
    orgId: updated.orgId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    isSuperadmin: updated.isSuperadmin,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
