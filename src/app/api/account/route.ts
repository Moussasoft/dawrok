import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/guards';
import { audit } from '@/lib/audit';

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
});

// Profil de la personne réellement connectée (jamais celui d'un compte imité).
export const PATCH = route(async (req) => {
  const auth = await requireAuth();
  const { name, email } = await parseBody(req, schema);
  if (!name && !email) throw new ApiError(400, 'nothing_to_update');

  if (email && email !== auth.actorEmail.toLowerCase()) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== auth.actorId) throw new ApiError(409, 'email_taken');
  }
  const user = await prisma.user.update({
    where: { id: auth.actorId },
    data: { ...(name && { name }), ...(email && { email }) },
    select: { id: true, name: true, email: true },
  });
  if (email) await audit({ action: 'user.email_change', actor: auth, targetType: 'user', targetId: user.id });
  return NextResponse.json({ ok: true, user });
});
