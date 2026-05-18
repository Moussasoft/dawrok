import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AdminSettingsClient from './settings-client';

export const dynamic = 'force-dynamic';

const PLAN_DEFAULTS = [
  { plan: 'free',     price: 0,   maxBranches: 1,  maxEmployees: 3,   maxServices: 5,   allowBooking: false, allowAnalytics: false, allowCustomBrand: false },
  { plan: 'starter',  price: 19,  maxBranches: 2,  maxEmployees: 10,  maxServices: 15,  allowBooking: true,  allowAnalytics: false, allowCustomBrand: false },
  { plan: 'pro',      price: 49,  maxBranches: 5,  maxEmployees: 30,  maxServices: 50,  allowBooking: true,  allowAnalytics: true,  allowCustomBrand: false },
  { plan: 'business', price: 129, maxBranches: 20, maxEmployees: 200, maxServices: 200, allowBooking: true,  allowAnalytics: true,  allowCustomBrand: true  },
];

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session?.isSuperadmin) redirect('/admin');

  // Seed plan configs if missing
  for (const d of PLAN_DEFAULTS) {
    await prisma.planConfig.upsert({ where: { plan: d.plan }, update: {}, create: d });
  }

  const [planConfigs, superadmins, notifRow] = await Promise.all([
    prisma.planConfig.findMany({ orderBy: { price: 'asc' } }),
    prisma.user.findMany({
      where: { isSuperadmin: true },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.systemConfig.findUnique({ where: { key: 'notifications' } }),
  ]);

  const notifications = notifRow
    ? JSON.parse(notifRow.value)
    : { newOrgSignup: true, orgSuspended: false, orgOverLimit: false, dailyReport: false, notifEmail: '' };

  return (
    <AdminSettingsClient
      currentUser={{ id: session.userId, name: session.name, email: session.email }}
      planConfigs={planConfigs}
      superadmins={superadmins}
      notifications={notifications}
    />
  );
}
