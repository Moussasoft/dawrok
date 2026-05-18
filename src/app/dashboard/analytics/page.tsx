import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/lib/utils';
import { Fragment } from 'react';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branch = await prisma.branch.findFirst({ where: { orgId: session.orgId } });
  if (!branch) redirect('/dashboard');

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const tickets = await prisma.ticket.findMany({
    where: { branchId: branch.id, createdAt: { gte: since } },
    select: {
      createdAt: true,
      completedAt: true,
      startedAt: true,
      status: true,
      serviceId: true,
      employeeId: true,
    },
  });

  const employees = await prisma.employee.findMany({
    where: { branchId: branch.id },
    select: { id: true, name: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e.name]));

  const total = tickets.length;
  const done = tickets.filter((t) => t.status === 'done').length;
  const noShow = tickets.filter((t) => t.status === 'no_show').length;
  const cancelled = tickets.filter((t) => t.status === 'cancelled').length;
  const noShowRate = total ? Math.round((noShow / total) * 100) : 0;

  // Avg service duration (started → completed)
  const durations = tickets
    .filter((t) => t.startedAt && t.completedAt)
    .map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()) / 60000);
  const avgService = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // Tickets per day (last 14 days)
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = tickets.filter((t) => t.createdAt >= d && t.createdAt < next).length;
    days.push({ date: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), count });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  // Hourly heatmap (0-23)
  const hours = new Array(24).fill(0);
  for (const t of tickets) hours[t.createdAt.getHours()]++;
  const maxHour = Math.max(1, ...hours);

  // Day of week
  const dows = new Array(7).fill(0);
  for (const t of tickets) dows[t.createdAt.getDay()]++;
  const dowLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const maxDow = Math.max(1, ...dows);

  // 2D heatmap: 7 days x 24 hours
  const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const t of tickets) heat[t.createdAt.getDay()][t.createdAt.getHours()]++;
  let maxHeat = 1;
  heat.forEach((row) => row.forEach((v) => (maxHeat = Math.max(maxHeat, v))));

  // Per-employee stats
  const empStats = new Map<
    string,
    { total: number; durations: number[]; done: number; noShow: number }
  >();
  for (const t of tickets) {
    if (!t.employeeId) continue;
    const name = empMap.get(t.employeeId) ?? '—';
    const e = empStats.get(name) ?? { total: 0, durations: [], done: 0, noShow: 0 };
    e.total++;
    if (t.status === 'done') e.done++;
    if (t.status === 'no_show') e.noShow++;
    if (t.startedAt && t.completedAt) {
      e.durations.push((t.completedAt.getTime() - t.startedAt.getTime()) / 60000);
    }
    empStats.set(name, e);
  }
  const empRows = Array.from(empStats.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      done: s.done,
      noShow: s.noShow,
      avgDur: s.durations.length ? s.durations.reduce((a, b) => a + b, 0) / s.durations.length : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="container py-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Analytics</h1>
          <p className="text-muted-foreground">30 derniers jours</p>
        </div>
        <a
          href="/api/analytics/export"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:bg-accent text-sm font-medium"
        >
          ⬇️ Exporter CSV (90j)
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Tickets totaux" value={total.toString()} />
        <Stat label="Servis" value={done.toString()} accent="text-emerald-600" />
        <Stat label="No-show" value={`${noShow} (${noShowRate}%)`} accent={noShowRate > 15 ? 'text-amber-600' : ''} />
        <Stat label="Durée moyenne" value={formatDuration(avgService)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Tickets / jour (14j)</h3>
            <div className="flex items-end gap-1 h-40">
              {days.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-muted-foreground tabular-nums">{d.count || ''}</div>
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? '4px' : '0' }}
                  />
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap rotate-[-30deg] origin-top-left">{d.date}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Affluence par heure</h3>
            <div className="grid grid-cols-12 gap-1">
              {hours.map((h, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className="w-full aspect-square rounded"
                    style={{
                      backgroundColor: `hsl(243 75% 59% / ${h / maxHour || 0.05})`,
                    }}
                    title={`${i}h : ${h} tickets`}
                  />
                  <div className="text-[9px] text-muted-foreground mt-1">{i}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-3">
              Pic : {hours.indexOf(maxHour)}h ({maxHour} tickets)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Affluence par jour de la semaine</h3>
            <div className="space-y-2">
              {dows.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 text-sm font-medium">{dowLabels[i]}</div>
                  <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(c / maxDow) * 100}%` }} />
                  </div>
                  <div className="w-10 text-sm text-right tabular-nums">{c}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Synthèse</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">Annulés</span><span className="font-medium">{cancelled}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Taux de complétion</span><span className="font-medium">{total ? Math.round((done / total) * 100) : 0}%</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Tickets / jour (moy.)</span><span className="font-medium">{Math.round(total / 30)}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Durée service moy.</span><span className="font-medium">{formatDuration(avgService)}</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 2D heatmap */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Heatmap jour × heure</h3>
            <div className="overflow-x-auto">
              <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: '40px repeat(24, minmax(18px, 1fr))' }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-[9px] text-muted-foreground text-center">{h}</div>
                ))}
                {dowLabels.map((d, i) => (
                  <Fragment key={`row-${i}`}>
                    <div className="text-xs text-muted-foreground self-center">{d}</div>
                    {heat[i].map((v, h) => (
                      <div
                        key={`c${i}${h}`}
                        className="aspect-square rounded-sm"
                        style={{
                          backgroundColor: `hsl(243 75% 59% / ${v / maxHeat || 0.04})`,
                        }}
                        title={`${d} ${h}h : ${v}`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-employee */}
      {empRows.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Par employé</h3>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">Employé</th>
                    <th className="text-right">Tickets</th>
                    <th className="text-right">Servis</th>
                    <th className="text-right">No-show</th>
                    <th className="text-right">Durée moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {empRows.map((r) => (
                    <tr key={r.name} className="border-t">
                      <td className="py-2 font-medium">{r.name}</td>
                      <td className="text-right tabular-nums">{r.total}</td>
                      <td className="text-right tabular-nums text-emerald-600">{r.done}</td>
                      <td className="text-right tabular-nums text-amber-600">{r.noShow}</td>
                      <td className="text-right tabular-nums">{formatDuration(r.avgDur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
