import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { hashPassword, MIN_PASSWORD_LENGTH } from '@/lib/passwords';
import { createSession, setSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';

const schema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(100),
  acceptTerms: z.boolean().optional(),
});

export const POST = route(async (req) => {
  await enforceRateLimit(`accept:ip:${clientIp(req)}`, 20, 15 * 60_000);
  const { token, name, password, acceptTerms } = await parseBody(req, schema);
  if (!acceptTerms) throw new ApiError(400, 'terms_required');

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new ApiError(400, 'invitation_invalid');
  if (invitation.organization.suspended) throw new ApiError(403, 'org_suspended');

  const passwordHash = await hashPassword(password);
  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      // Marquage conditionnel : une invitation ne peut être acceptée qu'une fois.
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw new ApiError(400, 'invitation_invalid');
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name,
          passwordHash,
          role: invitation.role,
          orgId: invitation.orgId,
          termsAcceptedAt: new Date(),
        },
      });
      return user.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ApiError(409, 'email_taken');
    throw e;
  }

  await audit({ action: 'team.join', orgId: invitation.orgId, targetType: 'user', targetId: userId, metadata: { role: invitation.role } });
  await setSessionCookie(await createSession({ userId }));
  return NextResponse.json({ ok: true });
});
