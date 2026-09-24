import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { hashPassword, minPasswordLength } from '@/lib/passwords';
import { createSession, setSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(100),
});

export const POST = route(async (req) => {
  enforceRateLimit(`reset:ip:${clientIp(req)}`, 20, 15 * 60_000);
  const { token, password } = await parseBody(req, schema);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { organization: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw new ApiError(400, 'invalid_reset_token');
  const { user } = record;
  const min = minPasswordLength(user.isSuperadmin);
  if (password.length < min) throw new ApiError(400, 'password_too_short', { min });

  const now = new Date();
  await prisma.$transaction([
    // passwordChangedAt révoque toutes les sessions existantes (autres appareils compris).
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: now } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: record.id } } }),
  ]);
  await audit({ action: 'user.password_reset', orgId: user.orgId, targetType: 'user', targetId: user.id });

  const suspended = !!user.organization?.suspended && !user.isSuperadmin;
  if (!suspended) await setSessionCookie(await createSession({ userId: user.id }));
  return NextResponse.json({ ok: true, loggedIn: !suspended, isSuperadmin: user.isSuperadmin, hasOrg: !!user.orgId });
});
