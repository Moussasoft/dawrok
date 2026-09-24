import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
});

// Profil du superadmin réellement connecté (jamais celui d'un compte imité).
export const PATCH = route(async (req) => {
  const auth = await requireSuperadmin();
  const { name, email } = await parseBody(req, schema);
  if (!name && !email) throw new ApiError(400, 'nothing_to_update');

  if (email && email !== auth.actorEmail) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== auth.actorId) throw new ApiError(409, 'email_taken');
  }

  const updated = await prisma.user.update({
    where: { id: auth.actorId },
    data: { ...(name && { name }), ...(email && { email }) },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ ok: true, user: updated });
});
