import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const superadmins = await prisma.user.findMany({
    where: { isSuperadmin: true },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ superadmins });
}

const inviteSchema = z.object({
  name:     z.string().min(2).max(80),
  email:    z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name:         parsed.data.name,
      email:        parsed.data.email,
      passwordHash,
      role:         'owner',
      isSuperadmin: true,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
