import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requireSuperadminPage } from '@/lib/guards';
import { CURRENCY, getAllPlanLimits } from '@/lib/plans';
import { readNotificationsConfig } from '@/lib/system-config';
import AdminSettingsClient from './settings-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('settings') };
}

export default async function AdminSettingsPage() {
  const auth = await requireSuperadminPage();
  const [planConfigs, superadmins, notifications] = await Promise.all([
    getAllPlanLimits(),
    prisma.user.findMany({
      where: { isSuperadmin: true },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    readNotificationsConfig(),
  ]);

  return (
    <AdminSettingsClient
      // Le profil affiché est celui du superadmin réellement connecté, même pendant une imitation.
      currentUser={{ id: auth.actorId, name: auth.actorName, email: auth.actorEmail }}
      currency={CURRENCY}
      planConfigs={planConfigs}
      superadmins={superadmins.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      notifications={notifications}
    />
  );
}
