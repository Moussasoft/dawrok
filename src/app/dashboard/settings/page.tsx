import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SettingsClient } from '@/components/settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId ?? undefined },
    include: {
      branches: { include: { services: true, employees: true } },
    },
  });
  if (!org) redirect('/login');

  return <SettingsClient org={org} branches={org.branches} />;
}
