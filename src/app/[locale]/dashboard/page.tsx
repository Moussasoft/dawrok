import { getTranslations } from 'next-intl/server';
import { requireOrgPage } from '@/lib/guards';
import { getActiveBranch } from '@/lib/branch';
import { prisma } from '@/lib/db';
import { redirectTo } from '@/i18n/server';
import { smsOfferFor } from '@/lib/sms-notify';
import { LiveDashboard } from './live-dashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('dashboard');
  return { title: t('liveTitle') };
}

export default async function DashboardPage() {
  const auth = await requireOrgPage();
  const branch = await getActiveBranch(auth);
  if (!branch) return redirectTo('/dashboard/settings');

  const [employees, services, org] = await Promise.all([
    prisma.employee.findMany({ where: { branchId: branch.id, active: true }, orderBy: { name: 'asc' } }),
    prisma.service.findMany({ where: { branchId: branch.id, active: true }, orderBy: { name: 'asc' } }),
    prisma.organization.findUnique({ where: { id: auth.orgId }, select: { smsEnabled: true, smsChannel: true, plan: true } }),
  ]);
  const smsChannel = org ? await smsOfferFor(org) : null;

  return (
    <div className="container py-6">
      <LiveDashboard
        key={branch.id}
        branchId={branch.id}
        qrToken={branch.qrToken}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        smsChannel={smsChannel}
      />
    </div>
  );
}
