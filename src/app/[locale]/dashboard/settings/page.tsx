import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requireOrgPage } from '@/lib/guards';
import { countOrgResources, getOrgLimits } from '@/lib/plans';
import { parseOpenHours } from '@/lib/opening-hours';
import { redirectTo } from '@/i18n/server';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const auth = await requireOrgPage();
  const [org, limits, usage] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: auth.orgId },
      include: {
        branches: {
          orderBy: { createdAt: 'asc' },
          include: { services: { orderBy: { name: 'asc' } }, employees: { orderBy: { name: 'asc' } } },
        },
      },
    }),
    getOrgLimits(auth.orgId),
    countOrgResources(auth.orgId),
  ]);
  if (!org) return redirectTo('/login');

  return (
    <SettingsClient
      // Pendant une imitation, le compte affiché serait celui du superadmin : on le masque.
      account={auth.impersonating ? null : { name: auth.actorName, email: auth.actorEmail }}
      org={{ id: org.id, name: org.name, slug: org.slug, sector: org.sector, plan: org.plan, brandColor: org.brandColor }}
      limits={limits}
      usage={usage}
      branches={org.branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        timezone: b.timezone,
        allowBooking: b.allowBooking,
        bookingSlotMin: b.bookingSlotMin,
        openHours: parseOpenHours(b.openHours),
        services: b.services.map((s) => ({ id: s.id, name: s.name, avgDurationMin: s.avgDurationMin, active: s.active })),
        employees: b.employees.map((e) => ({ id: e.id, name: e.name, active: e.active })),
      }))}
    />
  );
}
