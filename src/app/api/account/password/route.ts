import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/guards';
import { createSession, getSession, setSessionCookie } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { hashPassword, minPasswordLength, verifyPassword } from '@/lib/passwords';
import { audit } from '@/lib/audit';

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(100),
});

// Changement du mot de passe de la personne connectée : les autres appareils sont déconnectés,
// l'appareil courant reçoit une nouvelle session.
export const POST = route(async (req) => {
  const auth = await requireAuth();
  await enforceRateLimit(`password:${auth.actorId}`, 10, 15 * 60_000);
  const { currentPassword, newPassword } = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { id: auth.actorId } });
  if (!user) throw new ApiError(404, 'not_found');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new ApiError(400, 'wrong_password');
  const min = minPasswordLength(user.isSuperadmin);
  if (newPassword.length < min) throw new ApiError(400, 'password_too_short', { min });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() },
  });
  const session = await getSession();
  await setSessionCookie(
    await createSession({ userId: session?.userId ?? user.id, impersonatedFromUserId: session?.impersonatedFromUserId })
  );
  await audit({ action: 'user.password_change', actor: auth, targetType: 'user', targetId: user.id });
  return NextResponse.json({ ok: true });
});
