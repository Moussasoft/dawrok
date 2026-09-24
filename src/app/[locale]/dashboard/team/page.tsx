import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requireOrgPageRole } from '@/lib/guards';
import { mailConfigured } from '@/lib/mail';
import { TeamClient } from './team-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('team');
  return { title: t('title') };
}

export default async function TeamPage() {
  const auth = await requireOrgPageRole('owner');
  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: auth.orgId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { orgId: auth.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <TeamClient
      currentUserId={auth.userId}
      mailEnabled={mailConfigured()}
      members={members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      invitations={invitations.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }))}
    />
  );
}
