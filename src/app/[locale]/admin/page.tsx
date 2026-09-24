import { getLocale, getTranslations } from 'next-intl/server';
import { Building2, Users, Ticket, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/db';
import { requireSuperadminPage } from '@/lib/guards';
import { CURRENCY, PLANS, getAllPlanLimits } from '@/lib/plans';
import { SECTOR_I18N_KEY } from '@/lib/sectors';
import { formatDate, formatNumber } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('overview') };
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-zinc-400',
  starter: 'bg-blue-500',
  pro: 'bg-violet-500',
  business: 'bg-amber-500',
};

export default async function AdminHomePage() {
  await requireSuperadminPage();
  const [t, tp, ts, locale] = await Promise.all([
    getTranslations('admin'),
    getTranslations('plans'),
    getTranslations('sectors'),
    getLocale(),
  ]);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since24 = new Date(Date.now() - 86_400_000);

  const [orgs, totalUsers, totalTickets, ticketsToday, ticketsLast30, recentOrgs, planLimits] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, plan: true, suspended: true, sector: true } }),
    prisma.user.count({ where: { isSuperadmin: false } }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { createdAt: { gte: since24 } } }),
    prisma.ticket.count({ where: { createdAt: { gte: since30 } } }),
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, plan: true, sector: true, createdAt: true, suspended: true },
    }),
    getAllPlanLimits(),
  ]);

  // MRR calculé sur les prix configurés par le superadmin (et non des prix codés en dur).
  const price = new Map(planLimits.map((p) => [p.plan, p.price]));
  const totalOrgs = orgs.length;
  const suspended = orgs.filter((o) => o.suspended).length;
  const mrr = orgs.reduce((sum, o) => sum + (o.suspended ? 0 : price.get(o.plan) ?? 0), 0);
  const planCounts: Record<string, number> = {};
  const sectorCounts: Record<string, number> = {};
  for (const o of orgs) {
    planCounts[o.plan] = (planCounts[o.plan] ?? 0) + 1;
    sectorCounts[o.sector] = (sectorCounts[o.sector] ?? 0) + 1;
  }
  const sectorTop = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
  const sectorLabel = (s: string) => ts((SECTOR_I18N_KEY as Record<string, string>)[s] ?? 'other');
  const planLabel = (p: string) => (tp.has(p) ? tp(p) : p);

  return (
    <div className="container py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('overview')}</h1>
      <p className="mb-6 text-muted-foreground">{t('overviewSubtitle')}</p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Building2 className="h-4 w-4" />}
          label={t('statOrgs')}
          value={`${totalOrgs - suspended} / ${totalOrgs}`}
          hint={t('statOrgsHint', { count: suspended })}
        />
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label={t('statMrr')}
          value={`${formatNumber(mrr, locale)} ${CURRENCY}`}
          accent="text-emerald-600"
          hint={t('statMrrHint')}
        />
        <Stat icon={<Users className="h-4 w-4" />} label={t('statUsers')} value={formatNumber(totalUsers, locale)} />
        <Stat
          icon={<Ticket className="h-4 w-4" />}
          label={t('statTicketsToday')}
          value={formatNumber(ticketsToday, locale)}
          hint={t('statTicketsTotal', { count: totalTickets })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('byPlan')}</h2>
            <div className="space-y-3">
              {PLANS.map((plan) => {
                const count = planCounts[plan] ?? 0;
                const pct = totalOrgs ? (count / totalOrgs) * 100 : 0;
                return (
                  <div key={plan} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium">{planLabel(plan)}</div>
                    <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
                      <div className={`h-full ${PLAN_COLORS[plan]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-20 text-end text-sm tabular-nums">
                      {count} <span className="text-xs text-muted-foreground">({Math.round(pct)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('bySector')}</h2>
            <div className="space-y-2">
              {sectorTop.length === 0 && <p className="text-sm text-muted-foreground">{t('noData')}</p>}
              {sectorTop.map(([sector, count]) => (
                <div key={sector} className="flex items-center justify-between text-sm">
                  <span>{sectorLabel(sector)}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('activity30')}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">{t('ticketsCreated')}</div>
                <div className="text-2xl font-bold tabular-nums">{formatNumber(ticketsLast30, locale)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('perDay')}</div>
                <div className="text-2xl font-bold tabular-nums">{Math.round(ticketsLast30 / 30)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{t('recentSignups')}</h2>
              <Link href="/admin/orgs" className="text-xs text-primary hover:underline">
                {t('seeAll')}
              </Link>
            </div>
            {recentOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noOrgs')}</p>
            ) : (
              <ul className="space-y-2">
                {recentOrgs.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{o.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {sectorLabel(o.sector)} · {formatDate(o.createdAt, locale)}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        o.suspended ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {o.suspended ? t('suspendedBadge') : planLabel(o.plan)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {suspended > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            {t('suspendedAlert', { count: suspended })}{' '}
            <Link href="/admin/orgs" className="font-medium text-amber-700 hover:underline dark:text-amber-400">
              {t('manage')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? ''}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
