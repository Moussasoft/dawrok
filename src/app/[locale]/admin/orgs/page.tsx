import { getLocale, getTranslations } from 'next-intl/server';
import { Info } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSuperadminPage } from '@/lib/guards';
import { CURRENCY, getAllPlanLimits } from '@/lib/plans';
import { SECTOR_I18N_KEY } from '@/lib/sectors';
import { formatNumber } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { OrgRowActions, PlanSelect } from './org-row-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('organizations') };
}

export default async function AdminOrgsPage() {
  await requireSuperadminPage();
  const [t, ts, locale, planLimits] = await Promise.all([
    getTranslations('admin'),
    getTranslations('sectors'),
    getLocale(),
    getAllPlanLimits(),
  ]);
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [orgs, ticketsByBranch, branches] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: { where: { role: 'owner' }, select: { email: true, name: true }, take: 1, orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.ticket.groupBy({ by: ['branchId'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.branch.findMany({ select: { id: true, orgId: true } }),
  ]);
  const branchToOrg = new Map(branches.map((b) => [b.id, b.orgId]));
  const ticketsByOrg = new Map<string, number>();
  for (const r of ticketsByBranch) {
    const orgId = branchToOrg.get(r.branchId);
    if (orgId) ticketsByOrg.set(orgId, (ticketsByOrg.get(orgId) ?? 0) + r._count._all);
  }
  const price = new Map(planLimits.map((p) => [p.plan, p.price]));

  return (
    <div className="container py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('organizations')}</h1>
      <p className="mb-6 text-muted-foreground">{t('orgsCount', { count: orgs.length })}</p>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-start">
                <th className="p-3 text-start font-medium">{t('colName')}</th>
                <th className="p-3 text-start font-medium">{t('colSector')}</th>
                <th className="p-3 text-start font-medium">{t('colOwner')}</th>
                <th className="p-3 text-start font-medium">{t('colPlan')}</th>
                <th className="p-3 text-end font-medium">{t('colMrr')}</th>
                <th className="p-3 text-end font-medium">{t('colTickets30')}</th>
                <th className="p-3 text-start font-medium">{t('colStatus')}</th>
                <th className="p-3 text-end font-medium">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{o.name}</div>
                    <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {o.slug}
                    </div>
                  </td>
                  <td className="p-3">{ts((SECTOR_I18N_KEY as Record<string, string>)[o.sector] ?? 'other')}</td>
                  <td className="p-3">
                    <div>{o.users[0]?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {o.users[0]?.email ?? ''}
                    </div>
                  </td>
                  <td className="p-3">
                    <PlanSelect orgId={o.id} plan={o.plan} />
                  </td>
                  <td className="p-3 text-end tabular-nums">
                    {o.suspended ? '—' : `${formatNumber(price.get(o.plan) ?? 0, locale)} ${CURRENCY}`}
                  </td>
                  <td className="p-3 text-end tabular-nums">{ticketsByOrg.get(o.id) ?? 0}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        o.suspended
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {o.suspended ? t('suspendedBadge') : t('activeBadge')}
                    </span>
                  </td>
                  <td className="p-3">
                    <OrgRowActions orgId={o.id} orgName={o.name} suspended={o.suspended} />
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    {t('noOrgs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {t('impersonateHint')}
      </p>
    </div>
  );
}
