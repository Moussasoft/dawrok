import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LiveDashboard } from './live-dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branch = await prisma.branch.findFirst({
    where: { orgId: session.orgId ?? undefined },
    include: {
      services: { where: { active: true } },
      employees: { where: { active: true } },
    },
  });
  if (!branch) redirect('/dashboard/settings');

  return (
    <div className="container py-6">
      <LiveDashboard
        qrToken={branch.qrToken}
        branchId={branch.id}
        employees={branch.employees.map((e) => ({ id: e.id, name: e.name }))}
      />
    </div>
  );
}
