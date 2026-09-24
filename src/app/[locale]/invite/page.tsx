import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { hashToken } from '@/lib/tokens';
import { isRole } from '@/lib/roles';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { InviteForm } from './invite-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('invite');
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const invitation = token
    ? await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { organization: true } })
    : null;
  const valid = invitation && !invitation.acceptedAt && invitation.expiresAt > new Date() && !invitation.organization.suspended;
  const t = await getTranslations('invite');
  const tr = await getTranslations('roles');

  return (
    <main className="gradient-mesh flex min-h-screen items-center justify-center p-4">
      {valid && token ? (
        <InviteForm
          token={token}
          orgName={invitation.organization.name}
          email={invitation.email}
          roleLabel={isRole(invitation.role) ? tr(invitation.role) : invitation.role}
        />
      ) : (
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 p-8 text-center">
            <p className="text-muted-foreground">{t('invalid')}</p>
            <Link href="/login" className="text-primary hover:underline">
              {t('goLogin')}
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
