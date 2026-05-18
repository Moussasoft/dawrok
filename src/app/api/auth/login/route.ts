import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { organization: true },
  });
  if (!user) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });

  if (user.organization?.suspended && !user.isSuperadmin) {
    return NextResponse.json({ error: 'Compte suspendu. Contactez le support.' }, { status: 403 });
  }

  const token = await createSession({
    userId: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperadmin: user.isSuperadmin,
  });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, isSuperadmin: user.isSuperadmin });
}
