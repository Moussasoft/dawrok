import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { ApiError, parseBody, route } from '@/lib/api';
import { clientIp, enforceRateLimit, resetRateLimit } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });

// Hash factice : on compare quand même quand l'email est inconnu, pour ne pas révéler
// par le temps de réponse quels comptes existent.
const DUMMY_HASH = '$2a$12$.MVE.01nMEo7VGSFlKXPaeNBRgqDs25m.QlaLwvmpbwpfqnLs1RHW';

export const POST = route(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
  const { email: rawEmail, password } = await parseBody(req, schema);
  const email = rawEmail.toLowerCase();
  await enforceRateLimit(`login:email:${email}`, 8, 15 * 60_000);

  // Les anciens comptes ont pu être créés avec des majuscules : on accepte les deux formes.
  const user = await prisma.user.findFirst({
    where: { email: { in: Array.from(new Set([rawEmail, email])) } },
    include: { organization: true },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, 'invalid_credentials');

  if (user.organization?.suspended && !user.isSuperadmin) throw new ApiError(403, 'account_suspended');

  await resetRateLimit(`login:email:${email}`);
  await setSessionCookie(await createSession({ userId: user.id }));
  return NextResponse.json({ ok: true, isSuperadmin: user.isSuperadmin, hasOrg: !!user.orgId });
});
