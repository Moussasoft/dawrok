import { Fragment } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { BarChart3, Download, Lock, MessageSquareQuote } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireOrgPageRole } from '@/lib/guards';
import { getActiveBranch } from '@/lib/branch';
import { getOrgLimits } from '@/lib/plans';
import { redirectTo } from '@/i18n/server';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime, formatDecimal, formatDuration, dayKeyParts, weekdayName, ticketLabel } from '@/lib/format';
import { DEFAULT_TIMEZONE, addDaysToKey, dayKey, getZonedParts } from '@/lib/time';
import { effectiveTime } from '@/lib/queue-logic';
import { summarizeRatings } from '@/lib/feedback';
import { Stars } from '../../t/[publicCode]/feedback-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('analytics');
  return { title: t('title') };
}

// Semaine affichée du lundi au dimanche.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function AnalyticsPage() {
  const auth = await requireOrgPageRole('manager');
  const [branch, limits, t, locale] = await Promise.all([
    getActiveBranch(auth),
    getOrgLimits(auth.orgId),
    getTranslations('analytics'),
    getLocale(),
  ]);
  if (!branch) return redirectTo('/dashboard');

  if (!limits.allowAnalytics) {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardContent className="p-10 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <h1 className="mt-4 text-xl font-bold">{t('lockedTitle')}</h1>
            <p className="mt-2 text-muted-foreground">{t('lockedDesc')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tz = branch.timezone || DEFAULT_TIMEZONE;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [tickets, employees, feedbacks] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        branchId: branch.id,
        status: { not: 'scheduled' },
        // Un RDV réservé il y a longtemps mais honoré ces 30 derniers jours compte aussi.
        OR: [{ createdAt: { gte: since } }, { kind: 'appointment', scheduledFor: { gte: since } }],
      },
      select: {
        createdAt: true,
        calledAt: true,
        completedAt: true,
        startedAt: true,
        status: true,
        kind: true,
        scheduledFor: true,
        employeeId: true,
      },
    }),
    prisma.employee.findMany({ where: { branchId: branch.id }, select: { id: true, name: true } }),
    prisma.feedback.findMany({
      where: { branchId: branch.id, createdAt: { gte: since } },
      select: {
        rating: true,
        comment: true,
        createdAt: true,
        ticket: { select: { number: true, employeeId: true, service: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const empName = new Map(employees.map((e) => [e.id, e.name]));

  const total = tickets.length;
  const done = tickets.filter((x) => x.status === 'done').length;
  const noShow = tickets.filter((x) => x.status === 'no_show').length;
  const cancelled = tickets.filter((x) => x.status === 'cancelled').length;
  const noShowRate = total ? Math.round((noShow / total) * 100) : 0;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const serviceDurations = tickets
    .filter((x) => x.status === 'done' && x.startedAt && x.completedAt)
    .map((x) => (x.completedAt!.getTime() - x.startedAt!.getTime()) / 60000);
  const waits = tickets.filter((x) => x.calledAt).map((x) => (x.calledAt!.getTime() - effectiveTime(x)) / 60000);
  const avgService = avg(serviceDurations);
  const avgWait = avg(waits.filter((w) => w >= 0));

  // Regroupements dans le fuseau de l'agence (et non celui du serveur), à l'heure de passage :
  // l'heure du rendez-vous pour un RDV, pas l'heure à laquelle il a été réservé.
  const zoned = tickets.map((x) => {
    const at = new Date(effectiveTime(x));
    return { ...x, parts: getZonedParts(at, tz), key: dayKey(at, tz) };
  });
  const today = dayKey(new Date(), tz);
  const days = Array.from({ length: 14 }, (_, i) => {
    const key = addDaysToKey(today, i - 13);
    const p = dayKeyParts(key, locale);
    return { key, label: `${p.weekday} ${p.day}`, count: zoned.filter((x) => x.key === key).length };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const hours = new Array(24).fill(0) as number[];
  const dows = new Array(7).fill(0) as number[];
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
  for (const x of zoned) {
    hours[x.parts.hour]++;
    dows[x.parts.weekday]++;
    heat[x.parts.weekday][x.parts.hour]++;
  }
  const maxHour = Math.max(1, ...hours);
  const maxDow = Math.max(1, ...dows);
  const maxHeat = Math.max(1, ...heat.flat());
  const peakHour = hours.indexOf(Math.max(...hours));

  const empStats = new Map<string, { total: number; durations: number[]; done: number; noShow: number }>();
  for (const x of tickets) {
    if (!x.employeeId) continue;
    const name = empName.get(x.employeeId) ?? '—';
    const e = empStats.get(name) ?? { total: 0, durations: [], done: 0, noShow: 0 };
    e.total++;
    if (x.status === 'done') e.done++;
    if (x.status === 'no_show') e.noShow++;
    if (x.status === 'done' && x.startedAt && x.completedAt) {
      e.durations.push((x.completedAt.getTime() - x.startedAt.getTime()) / 60000);
    }
    empStats.set(name, e);
  }
  // Satisfaction : avis laissés par les clients après leur passage.
  const satisfaction = summarizeRatings(feedbacks.map((f) => f.rating));
  const maxRating = Math.max(1, ...satisfaction.distribution);
  const recentComments = feedbacks.filter((f) => f.comment).slice(0, 8);
  const empRatings = new Map<string, number[]>();
  for (const f of feedbacks) {
    if (!f.ticket.employeeId) continue;
    const name = empName.get(f.ticket.employeeId) ?? '—';
    empRatings.set(name, [...(empRatings.get(name) ?? []), f.rating]);
  }

  const empRows = Array.from(empStats.entries())
    .map(([name, s]) => {
      const r = summarizeRatings(empRatings.get(name) ?? []);
      return { name, total: s.total, done: s.done, noShow: s.noShow, avgDur: avg(s.durations), rating: r.count ? r.average : null };
    })
    .sort((a, b) => b.total - a.total);
  const ratingLabel = (v: number) => formatDecimal(v, locale);

  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-primary" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('subtitle', { branch: branch.name })}</p>
        </div>
        <a
          href={`/api/analytics/export?locale=${locale}`}
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-4 w-4" /> {t('export')}
        </a>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('total')} value={String(total)} />
        <Stat label={t('served')} value={String(done)} accent="text-emerald-600" />
        <Stat label={t('noShow')} value={`${noShow} (${noShowRate}%)`} accent={noShowRate > 15 ? 'text-amber-600' : ''} />
        <Stat label={t('avgWait')} value={formatDuration(avgWait, locale)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('perDay')}</h2>
            <div className="flex h-44 items-end gap-1">
              {days.map((d) => (
                <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div className="text-[10px] tabular-nums text-muted-foreground">{d.count || ''}</div>
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? '4px' : '0' }}
                    title={`${d.label} : ${d.count}`}
                  />
                  <div className="whitespace-nowrap text-[9px] text-muted-foreground">{d.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('perHour')}</h2>
            <div className="grid grid-cols-12 gap-1" dir="ltr">
              {hours.map((h, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className="aspect-square w-full rounded"
                    style={{ backgroundColor: `hsl(243 75% 59% / ${h / maxHour || 0.05})` }}
                    title={t('hourTooltip', { hour: i, count: h })}
                  />
                  <div className="mt-1 text-[9px] text-muted-foreground">{i}</div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">{t('peak', { hour: peakHour, count: hours[peakHour] })}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('perWeekday')}</h2>
            <div className="space-y-2">
              {WEEK_ORDER.map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-medium">{weekdayName(d, locale)}</div>
                  <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(dows[d] / maxDow) * 100}%` }} />
                  </div>
                  <div className="w-10 text-end text-sm tabular-nums">{dows[d]}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('summary')}</h2>
            <ul className="space-y-3 text-sm">
              <SummaryRow label={t('cancelled')} value={String(cancelled)} />
              <SummaryRow label={t('completionRate')} value={`${total ? Math.round((done / total) * 100) : 0}%`} />
              <SummaryRow label={t('dailyAverage')} value={String(Math.round(total / 30))} />
              <SummaryRow label={t('avgService')} value={formatDuration(avgService, locale)} />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">{t('satisfaction')}</h2>
            {satisfaction.count === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noFeedback')}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <div className="text-4xl font-extrabold tabular-nums">
                    {ratingLabel(satisfaction.average)}
                    <span className="text-lg font-medium text-muted-foreground"> / 5</span>
                  </div>
                  <Stars value={satisfaction.average} className="mt-1" />
                  <div className="mt-1 text-xs text-muted-foreground">{t('ratingsCount', { count: satisfaction.count })}</div>
                </div>
                <div className="min-w-[180px] flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-3 tabular-nums">{n}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded bg-muted">
                        <div className="h-full bg-amber-400" style={{ width: `${(satisfaction.distribution[n - 1] / maxRating) * 100}%` }} />
                      </div>
                      <span className="w-6 text-end tabular-nums text-muted-foreground">{satisfaction.distribution[n - 1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <MessageSquareQuote className="h-4 w-4 text-primary" /> {t('recentComments')}
            </h2>
            {recentComments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noComments')}</p>
            ) : (
              <ul className="max-h-72 space-y-3 overflow-y-auto pe-1">
                {recentComments.map((f, i) => (
                  <li key={i} className="rounded-lg bg-muted/60 p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Stars value={f.rating} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />
                      <span>{formatDateTime(f.createdAt, locale, tz)}</span>
                      <span>· {ticketLabel(f.ticket.number)}</span>
                      {f.ticket.service?.name && <span>· {f.ticket.service.name}</span>}
                      {f.ticket.employeeId && <span>· {empName.get(f.ticket.employeeId) ?? '—'}</span>}
                    </div>
                    <p className="whitespace-pre-line break-words">{f.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="mb-4 font-semibold">{t('heatmap')}</h2>
          <div className="overflow-x-auto" dir="ltr">
            <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: '48px repeat(24, minmax(18px, 1fr))' }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-center text-[9px] text-muted-foreground">
                  {h}
                </div>
              ))}
              {WEEK_ORDER.map((d) => (
                <Fragment key={`row-${d}`}>
                  <div className="self-center text-xs text-muted-foreground">{weekdayName(d, locale)}</div>
                  {heat[d].map((v, h) => (
                    <div
                      key={`c${d}-${h}`}
                      className="aspect-square rounded-sm"
                      style={{ backgroundColor: `hsl(243 75% 59% / ${v / maxHeat || 0.04})` }}
                      title={`${weekdayName(d, locale)} ${h}h : ${v}`}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {empRows.length > 0 && (
        <Card className="mt-6">
          <CardContent className="overflow-x-auto p-6">
            <h2 className="mb-4 font-semibold">{t('perEmployee')}</h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-start">{t('employee')}</th>
                  <th className="text-end">{t('tickets')}</th>
                  <th className="text-end">{t('served')}</th>
                  <th className="text-end">{t('noShow')}</th>
                  <th className="text-end">{t('avgService')}</th>
                  <th className="text-end">{t('rating')}</th>
                </tr>
              </thead>
              <tbody>
                {empRows.map((r) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="text-end tabular-nums">{r.total}</td>
                    <td className="text-end tabular-nums text-emerald-600">{r.done}</td>
                    <td className="text-end tabular-nums text-amber-600">{r.noShow}</td>
                    <td className="text-end tabular-nums">{formatDuration(r.avgDur, locale)}</td>
                    <td className="text-end tabular-nums">{r.rating === null ? '—' : `${ratingLabel(r.rating)} ★`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}
