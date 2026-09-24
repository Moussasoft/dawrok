import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createToken } from '@/lib/tokens';
import { ROLES } from '@/lib/roles';
import { mailConfigured, sendMail } from '@/lib/mail';
import { invitationEmail } from '@/lib/mail-templates';
import { localizedUrl } from '@/lib/urls';
import { audit } from '@/lib/audit';
import { MESSAGES, toAppLocale } from '@/i18n/messages';
import { routing } from '@/i18n/routing';

const INVITE_TTL_MS = 7 * 24 * 3600_000;

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(ROLES),
  locale: z.enum(routing.locales).default(routing.defaultLocale),
});

// Invitation d'un membre : le lien est toujours renvoyé au propriétaire (partage WhatsApp possible
// même sans e-mail configuré) et envoyé par e-mail quand un fournisseur est configuré.
export const POST = route(async (req) => {
  const auth = await requireOrgRole('owner');
  await enforceRateLimit(`invite:${auth.orgId}`, 30, 60 * 60_000);
  const { email, role, locale } = await parseBody(req, schema);

  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, 'email_taken');
  await prisma.invitation.deleteMany({ where: { orgId: auth.orgId, email, acceptedAt: null } });

  const { token, hash } = createToken();
  const invitation = await prisma.invitation.create({
    data: { orgId: auth.orgId, email, role, tokenHash: hash, invitedById: auth.actorId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: auth.orgId }, select: { name: true } });
  const inviteUrl = localizedUrl(`/invite?token=${token}`, locale);
  const loc = toAppLocale(locale);
  const roleLabel = MESSAGES[loc].roles[role];
  const emailSent = mailConfigured()
    ? await sendMail(invitationEmail(email, inviteUrl, loc, { org: org.name, inviter: auth.actorName, role: roleLabel }))
    : false;

  await audit({ action: 'team.invite', actor: auth, targetType: 'invitation', targetId: invitation.id, metadata: { email, role } });
  return NextResponse.json({ ok: true, inviteUrl, emailSent }, { status: 201 });
});
