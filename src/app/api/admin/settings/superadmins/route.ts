import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { audit } from '@/lib/audit';
import { MIN_SUPERADMIN_PASSWORD_LENGTH, hashPassword } from '@/lib/passwords';

export const GET = route(async () => {
  await requireSuperadmin();
  const superadmins = await prisma.user.findMany({
    where: { isSuperadmin: true },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ superadmins });
});

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(MIN_SUPERADMIN_PASSWORD_LENGTH).max(100),
});

export const POST = route(async (req) => {
  const auth = await requireSuperadmin();
  const data = await parseBody(req, inviteSchema);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new ApiError(409, 'email_taken');

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: 'owner',
      isSuperadmin: true,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  await audit({ action: 'superadmin.invite', actor: auth, targetType: 'user', targetId: user.id, metadata: { email: user.email } });
  return NextResponse.json({ user }, { status: 201 });
});
