import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, Ticket, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PLAN_PRICES: Record<string, number> = { free: 0, starter: 19, pro: 49, business: 129 };

export default async function AdminHomePage() {
  const [orgs, totalUsers, totalTickets, ticketsToday, ticketsLast30, recentOrgs, suspended] =
    await Promise.all([
      prisma.organization.findMany({
        select: { id: true, plan: true, suspended: true, sector: true, createdAt: true },
      }),
      prisma.user.count({ where: { isSuperadmin: false } }),
      prisma.ticket.count(),
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: (() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              return d;
            })(),
          },
        },
      }),
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: (() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              return d;
            })(),
          },
        },
      }),
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, plan: true, sector: true, createdAt: true, suspended: true },
      }),
      prisma.organization.count({ where: { suspended: true } }),
    ]);

  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => !o.suspended).length;
  const mrr = orgs.reduce((sum, o) => sum + (o.suspended ? 0 : PLAN_PRICES[o.plan] ?? 0), 0);

  // Plan distribution
  const planCounts: Record<string, number> = {};
  for (const o of orgs) planCounts[o.plan] = (planCounts[o.plan] ?? 0) + 1;

  // Sector distribution
  const sectorCounts: Record<string, number> = {};
  for (const o of orgs) sectorCounts[o.sector] = (sectorCounts[o.sector] ?? 0) + 1;
  const sectorTop = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-1">Vue globale</h1>
      <p className="text-muted-foreground mb-6">Pilotage de la plateforme Daourak.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Building2 className="h-4 w-4" />} label="Organisations" value={`${activeOrgs} / ${totalOrgs}`} hint={`${suspended} suspendues`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="MRR estimé" value={`${mrr} €`} accent="text-emerald-600" hint="abonnements actifs" />
        <Stat icon={<Users className="h-4 w-4" />} label="Utilisateurs pro" value={totalUsers.toString()} />
        <Stat icon={<Ticket className="h-4 w-4" />} label="Tickets aujourd'hui" value={ticketsToday.toString()} hint={`${totalTickets} au total`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Répartition par plan</h3>
            <div className="space-y-3">
              {(['free', 'starter', 'pro', 'business'] as const).map((plan) => {
                const count = planCounts[plan] ?? 0;
                const pct = totalOrgs ? (count / totalOrgs) * 100 : 0;
                return (
                  <div key={plan} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium capitalize">{plan}</div>
                    <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          plan === 'free' ? 'bg-zinc-400' :
                          plan === 'starter' ? 'bg-blue-500' :
                          plan === 'pro' ? 'bg-violet-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-16 text-sm text-right tabular-nums">
                      {count} <span className="text-muted-foreground text-xs">({Math.round(pct)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Répartition par secteur</h3>
            <div className="space-y-2">
              {sectorTop.length === 0 && <p className="text-muted-foreground text-sm">Aucune donnée.</p>}
              {sectorTop.map(([sector, count]) => (
                <div key={sector} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{sector.replace('_', ' ')}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Activité (30 jours)</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Tickets créés</div>
                <div className="text-2xl font-bold">{ticketsLast30.toLocaleString('fr-FR')}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Moyenne / jour</div>
                <div className="text-2xl font-bold">{Math.round(ticketsLast30 / 30)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Dernières inscriptions</h3>
              <Link href="/admin/orgs" className="text-xs text-primary hover:underline">Voir tout →</Link>
            </div>
            {recentOrgs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune organisation.</p>
            ) : (
              <ul className="space-y-2">
                {recentOrgs.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{o.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.sector} · {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      o.suspended ? 'bg-rose-100 text-rose-700' : 'bg-primary/10 text-primary'
                    }`}>
                      {o.suspended ? 'Suspendu' : o.plan}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {suspended > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex items-center gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <strong>{suspended}</strong> organisation{suspended > 1 ? 's' : ''} suspendue{suspended > 1 ? 's' : ''}.{' '}
            <Link href="/admin/orgs" className="text-amber-700 hover:underline font-medium">Gérer →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, hint, accent,
}: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}
