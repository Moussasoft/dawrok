import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody, route } from '@/lib/api';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { createToken } from '@/lib/tokens';
import { sendMail } from '@/lib/mail';
import { resetPasswordEmail } from '@/lib/mail-templates';
import { localizedUrl } from '@/lib/urls';
import { routing } from '@/i18n/routing';

const RESET_TTL_MS = 60 * 60_000;

const schema = z.object({
  email: z.string().trim().email().max(200),
  locale: z.enum(routing.locales).default(routing.defaultLocale),
});

// Réponse identique que le compte existe ou non (pas d'énumération) ; l'e-mail part après la réponse.
export const POST = route(async (req) => {
  await enforceRateLimit(`forgot:ip:${clientIp(req)}`, 10, 15 * 60_000);
  const { email, locale } = await parseBody(req, schema);
  const lower = email.toLowerCase();
  await enforceRateLimit(`forgot:email:${lower}`, 3, 60 * 60_000);

  after(async () => {
    const user = await prisma.user.findFirst({ where: { email: { in: Array.from(new Set([email, lower])) } } });
    if (!user) return;
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const { token, hash } = createToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await sendMail(resetPasswordEmail(user.email, localizedUrl(`/reset-password?token=${token}`, locale), locale));
  });

  return NextResponse.json({ ok: true });
});
