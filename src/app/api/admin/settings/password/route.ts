import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { enforceRateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(100),
});

// S'applique toujours au superadmin réellement connecté, même pendant une imitation.
export const POST = route(async (req) => {
  const auth = await requireSuperadmin();
  enforceRateLimit(`password:${auth.actorId}`, 10, 15 * 60_000);
  const data = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { id: auth.actorId } });
  if (!user) throw new ApiError(404, 'not_found');
  if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) throw new ApiError(400, 'wrong_password');

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(data.newPassword, 12) } });
  await audit({ action: 'superadmin.password', actor: auth, targetType: 'user', targetId: user.id });
  return NextResponse.json({ ok: true });
});
