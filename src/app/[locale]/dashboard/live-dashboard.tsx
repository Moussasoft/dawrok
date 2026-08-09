'use client';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useEventSource } from '@/lib/use-event-source';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronRight,
  X,
  Play,
  CheckCircle2,
  UserX,
  Users,
  Clock,
  RefreshCcw,
  Pause,
  PlayCircle,
  Tv,
  Lock,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { toast } from 'sonner';

type Snapshot = {
  branchId: string;
  branchName: string;
  orgName: string;
  brandColor: string;
  logoUrl: string | null;
  closedUntil: string | null;
  closureReason: string | null;
  isPaused: boolean;
  updatedAt: string;
  tickets: Array<{
    id: string;
    publicCode: string;
    number: number;
    customerName: string;
    status: string;
    serviceName: string | null;
    employeeName: string | null;
    position: number;
    etaMin: number;
    createdAt: string;
    calledAt: string | null;
  }>;
};

type Props = {
  qrToken: string;
  branchId: string;
  employees: { id: string; name: string }[];
};

export function LiveDashboard({ qrToken, branchId, employees }: Props) {
  const { data, connected } = useEventSource<Snapshot>(`/api/stream/branch/${qrToken}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [pauseLoading, setPauseLoading] = useState(false);
  const t = useTranslations('dashboard');

  const stats = useMemo(() => {
    if (!data) return { total: 0, waiting: 0, inProgress: 0, avgWait: 0 };
    const waiting = data.tickets.filter((t) => t.status === 'waiting').length;
    const inProgress = data.tickets.filter((t) => t.status === 'in_progress' || t.status === 'called').length;
    const totalEta = data.tickets.filter((t) => t.status === 'waiting').reduce((s, t) => s + t.etaMin, 0);
    const avgWait = waiting ? totalEta / waiting : 0;
    return { total: data.tickets.length, waiting, inProgress, avgWait };
  }, [data]);

  async function action(id: string, status: string, employeeId?: string | null) {
    setBusy(id);
    const r = await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, employeeId: employeeId ?? undefined }),
    });
    setBusy(null);
    if (!r.ok) toast.error(t('actionImpossible'));
  }

  async function togglePause() {
    if (!data) return;
    setPauseLoading(true);
    if (data.isPaused) {
      const r = await fetch(`/api/branches/${branchId}/closure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedUntil: null }),
      });
      setPauseLoading(false);
      if (r.ok) toast.success(t('queueReopened'));
      else toast.error(t('error'));
    } else {
      const minutesStr = prompt(t('pausePrompt'), '30');
      if (!minutesStr) {
        setPauseLoading(false);
        return;
      }
      const minutes = parseInt(minutesStr, 10);
      if (isNaN(minutes) || minutes <= 0) {
        setPauseLoading(false);
        return;
      }
      const reason = prompt(t('pauseReason'), t('pauseReasonDefault')) || null;
      const closedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
      const r = await fetch(`/api/branches/${branchId}/closure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedUntil, reason }),
      });
      setPauseLoading(false);
      if (r.ok) toast.success(`${t('pausedFor')} ${minutes} ${t('min')}`);
      else toast.error(t('error'));
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-12 w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
        <div className="skeleton h-40" />
      </div>
    );
  }

  const next = data.tickets.find((t) => t.status === 'waiting');
  const active = data.tickets.filter((t) => t.status === 'called' || t.status === 'in_progress');
  const queue = data.tickets.filter((t) => t.status === 'waiting');

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Closure banner */}
      {data.isPaused && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-wrap items-center gap-3">
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{t('closedTitle')}</div>
            <div className="text-sm text-muted-foreground">
              {data.closureReason && <span>{data.closureReason} · </span>}
              {t('reopenAt')} {data.closedUntil ? new Date(data.closedUntil).toLocaleTimeString('fr-FR') : ''}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={togglePause} disabled={pauseLoading}>
            <PlayCircle className="h-5 w-5" /> {t('reopen')}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{data.branchName}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {connected ? t('live') : t('reconnecting')}
            <span>· {t('updated')} {new Date(data.updatedAt).toLocaleTimeString('fr-FR')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!data.isPaused && (
            <Button size="sm" variant="outline" onClick={togglePause} disabled={pauseLoading}>
              <Pause className="h-5 w-5" /> {t('pause')}
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <a href={`/screen/${qrToken}`} target="_blank" rel="noreferrer">
              <Tv className="h-5 w-5" /> {t('tvMode')}
            </a>
          </Button>
        </div>
      </div>

      {/* Big "Call next" CTA — sticky on mobile so the thumb always reaches it */}
      {next && !data.isPaused && (
        <div className="sticky top-2 z-20">
          <Button
            size="lg"
            variant="success"
            className="w-full h-14 text-base shadow-lg"
            onClick={() => action(next.id, 'called')}
            disabled={busy === next.id}
          >
            <ChevronRight className="h-6 w-6" /> {t('callNext')} — #{String(next.number).padStart(3, '0')} ·{' '}
            {next.customerName}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="h-5 w-5" />} label={t('totalToday')} value={stats.total.toString()} />
        <StatCard icon={<Clock className="h-5 w-5" />} label={t('waitingLabel')} value={stats.waiting.toString()} accent="text-amber-600" />
        <StatCard icon={<Play className="h-5 w-5" />} label={t('inProgressLabel')} value={stats.inProgress.toString()} accent="text-violet-600" />
        <StatCard icon={<RefreshCcw className="h-5 w-5" />} label={t('avgWait')} value={formatDuration(stats.avgWait)} />
      </div>

      {/* Active tickets */}
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('activeSection')}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {active.map((ticket) => (
              <Card key={ticket.id} className="border-primary/40">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-extrabold tabular-nums">#{String(ticket.number).padStart(3, '0')}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div className="text-sm font-medium truncate">{ticket.customerName}</div>
                    {ticket.serviceName && <div className="text-xs text-muted-foreground">{ticket.serviceName}</div>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {ticket.status === 'called' && (
                      <Button size="sm" onClick={() => action(ticket.id, 'in_progress')} disabled={busy === ticket.id}>
                        <Play className="h-5 w-5" /> {t('start')}
                      </Button>
                    )}
                    <Button size="sm" variant="success" onClick={() => action(ticket.id, 'done')} disabled={busy === ticket.id}>
                      <CheckCircle2 className="h-5 w-5" /> {t('done')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => action(ticket.id, 'no_show')} disabled={busy === ticket.id}>
                      <UserX className="h-5 w-5" /> {t('absent')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Waiting queue */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t('queueSection')} ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-14 w-14 mx-auto text-muted-foreground/40 mb-3" />
              <div className="font-medium">{t('noCustomers')}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {t('shareQR')}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {queue.map((ticket, idx) => (
              <Card key={ticket.id} className={idx === 0 ? 'ring-2 ring-primary/50' : ''}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-xl font-extrabold tabular-nums">#{String(ticket.number).padStart(3, '0')}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{t('position')} {idx + 1}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ticket.customerName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {ticket.serviceName && <span>{ticket.serviceName}</span>}
                      <span>· ~{ticket.etaMin} {t('min')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant={idx === 0 ? 'default' : 'outline'} onClick={() => action(ticket.id, 'called')} disabled={busy === ticket.id}>
                      <ChevronRight className="h-5 w-5" /> {t('call')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => action(ticket.id, 'cancelled')} disabled={busy === ticket.id}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {employees.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('employees', { count: employees.length, plural: employees.length > 1 ? 's' : '' })}
        </p>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
