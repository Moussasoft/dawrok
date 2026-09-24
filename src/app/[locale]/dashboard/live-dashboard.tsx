'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ChevronRight,
  X,
  Play,
  CheckCircle2,
  UserX,
  Users,
  Clock,
  Pause,
  PlayCircle,
  Tv,
  Lock,
  Megaphone,
  Undo2,
  Plus,
  CalendarClock,
  Timer,
  MonitorSmartphone,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useEventSource } from '@/lib/use-event-source';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { formatDuration, formatTime, ticketLabel } from '@/lib/format';
import type { DashboardSnapshot, QueueTicket } from '@/lib/queue-types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { PauseDialog } from './pause-dialog';
import { CounterTicketDialog } from './counter-ticket-dialog';

type Option = { id: string; name: string };
type Props = { branchId: string; qrToken: string; employees: Option[]; services: Option[] };

type TicketPatch = { status?: string; employeeId?: string | null; action?: 'recall' };

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Poste de travail de CET appareil, mémorisé localement. */
function useStation(branchId: string, employees: Option[]) {
  const storageKey = `daourak:station:${branchId}`;
  const [station, setStation] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && employees.some((e) => e.id === saved)) setStation(saved);
    } catch {
      /* stockage indisponible (navigation privée) */
    }
  }, [storageKey, employees]);
  const update = useCallback(
    (value: string | null) => {
      setStation(value);
      try {
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
      } catch {
        /* ignoré */
      }
    },
    [storageKey]
  );
  return [station, update] as const;
}

export function LiveDashboard({ branchId, qrToken, employees, services }: Props) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { data, connected, failed } = useEventSource<DashboardSnapshot>(`/api/stream/dashboard/${branchId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [station, setStation] = useStation(branchId, employees);
  const now = useNow(30_000);

  const patch = useCallback(
    async (ticket: QueueTicket, body: TicketPatch, successKey: string, undoBody?: TicketPatch) => {
      setBusy(ticket.id);
      const res = await apiFetch(`/api/tickets/${ticket.id}`, { method: 'PATCH', json: body });
      setBusy(null);
      if (!res.ok) {
        toast.error(errorMessage(res));
        return;
      }
      const number = ticketLabel(ticket.number);
      toast.success(t(successKey, { number }), {
        action: undoBody
          ? {
              label: (
                <span className="inline-flex items-center gap-1">
                  <Undo2 className="h-3.5 w-3.5" /> {t('undo')}
                </span>
              ),
              onClick: async () => {
                const undo = await apiFetch(`/api/tickets/${ticket.id}`, { method: 'PATCH', json: undoBody });
                if (undo.ok) toast(t('undone'));
                else toast.error(errorMessage(undo));
              },
            }
          : undefined,
      });
    },
    [errorMessage, t]
  );

  const actions = useMemo(
    () => ({
      call: (tk: QueueTicket) =>
        patch(tk, { status: 'called', ...(station && { employeeId: station }) }, 'calledToast', { status: 'waiting' }),
      recall: (tk: QueueTicket) => patch(tk, { action: 'recall' }, 'recalledToast'),
      start: (tk: QueueTicket) =>
        patch(tk, { status: 'in_progress', ...(!tk.employeeId && station && { employeeId: station }) }, 'startedToast', {
          status: 'called',
        }),
      done: (tk: QueueTicket) => patch(tk, { status: 'done' }, 'doneToast', { status: tk.status }),
      noShow: (tk: QueueTicket) => patch(tk, { status: 'no_show' }, 'noShowToast', { status: tk.status }),
      requeue: (tk: QueueTicket) => patch(tk, { status: 'waiting' }, 'requeuedToast', { status: 'called' }),
      cancel: (tk: QueueTicket) => patch(tk, { status: 'cancelled' }, 'cancelledToast', { status: 'waiting' }),
    }),
    [patch, station]
  );

  const queue = useMemo(() => data?.tickets.filter((x) => x.status === 'waiting') ?? [], [data]);
  const active = useMemo(() => data?.tickets.filter((x) => x.status !== 'waiting') ?? [], [data]);
  const next = queue[0];

  // Raccourci clavier « N » : appeler le suivant (poste fixe au comptoir).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.closest('dialog')) return;
      if (next && busy !== next.id) actions.call(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, busy, actions]);

  async function reopen() {
    const res = await apiFetch(`/api/branches/${branchId}/closure`, { method: 'PATCH', json: { closedUntil: null } });
    if (res.ok) toast.success(t('queueReopened'));
    else toast.error(errorMessage(res));
  }

  if (failed && !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">{t('actionImpossible')}</CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="skeleton h-12 w-1/3" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
        <div className="skeleton h-40" />
      </div>
    );
  }

  const minutesSince = (iso: string | null) => (iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 60000)) : 0);

  return (
    <div className="animate-fade-up space-y-6">
      {data.isPaused && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Lock className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t('closedTitle')}</div>
            <div className="text-sm text-muted-foreground">
              {data.closureReason && <span>{data.closureReason} · </span>}
              {t('reopenAt')} {data.closedUntil ? formatTime(data.closedUntil, locale, data.timezone) : ''}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={reopen}>
            <PlayCircle className="h-5 w-5" /> {t('reopen')}
          </Button>
        </div>
      )}
      {!data.isPaused && !data.isOpenNow && (
        <div className="flex items-center gap-3 rounded-2xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          <Clock className="h-5 w-5 flex-shrink-0" />
          {t('outsideHours')}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.branchName}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-success' : 'bg-muted-foreground'}`} />
            {connected ? t('live') : t('reconnecting')}
            <span>
              · {t('updated')} {formatTime(data.updatedAt, locale, data.timezone)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {employees.length > 0 && (
            <label className="flex items-center gap-2 text-sm" title={t('stationHint')}>
              <MonitorSmartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:text-muted-foreground">{t('station')}</span>
              <Select
                value={station ?? ''}
                onChange={(e) => setStation(e.target.value || null)}
                className="h-8 w-auto py-0 text-sm"
              >
                <option value="">{t('stationNone')}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <Button size="sm" variant="outline" onClick={() => setCounterOpen(true)}>
            <Plus className="h-4 w-4" /> {t('addTicket')}
          </Button>
          {!data.isPaused && (
            <Button size="sm" variant="outline" onClick={() => setPauseOpen(true)}>
              <Pause className="h-4 w-4" /> {t('pause')}
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/screen/${qrToken}`} target="_blank" rel="noreferrer">
              <Tv className="h-4 w-4" /> {t('tvMode')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Grand bouton « Appeler le suivant » — collant sur mobile pour rester sous le pouce */}
      {next && (
        <div className="sticky top-16 z-20">
          <Button
            size="lg"
            variant="success"
            className="h-14 w-full text-base shadow-lg"
            onClick={() => actions.call(next)}
            disabled={busy === next.id}
            aria-keyshortcuts="n"
          >
            <ChevronRight className="h-6 w-6 rtl:-scale-x-100" />
            <span className="truncate">
              {t('callNext')} — {ticketLabel(next.number)} · {next.customerName}
            </span>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label={t('totalToday')} value={String(data.stats.total)} />
        <StatCard icon={<Clock className="h-5 w-5" />} label={t('waitingLabel')} value={String(queue.length)} accent="text-amber-600" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label={t('servedToday')} value={String(data.stats.done)} accent="text-emerald-600" />
        <StatCard icon={<Timer className="h-5 w-5" />} label={t('avgWait')} value={formatDuration(data.stats.avgWaitMin, locale)} />
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('activeSection')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((ticket) => (
              <Card key={ticket.id} className={ticket.status === 'called' ? 'border-blue-400/60' : 'border-primary/40'}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xl font-extrabold tabular-nums">{ticketLabel(ticket.number)}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div className="truncate text-sm font-medium">{ticket.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {[ticket.serviceName, ticket.employeeName].filter(Boolean).join(' · ')}
                      {' · '}
                      {t('since', { minutes: minutesSince(ticket.startedAt ?? ticket.calledAt) })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {ticket.status === 'called' && (
                      <>
                        <Button size="sm" onClick={() => actions.start(ticket)} disabled={busy === ticket.id}>
                          <Play className="h-4 w-4" /> {t('start')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => actions.recall(ticket)} disabled={busy === ticket.id}>
                          <Megaphone className="h-4 w-4" /> {t('recall')}
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="success" onClick={() => actions.done(ticket)} disabled={busy === ticket.id}>
                      <CheckCircle2 className="h-4 w-4" /> {t('done')}
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => actions.noShow(ticket)}
                        disabled={busy === ticket.id}
                      >
                        <UserX className="h-4 w-4" /> {t('absent')}
                      </Button>
                      {ticket.status === 'called' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => actions.requeue(ticket)}
                          disabled={busy === ticket.id}
                          aria-label={t('requeue')}
                          title={t('requeue')}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('queueSection')} ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="mx-auto mb-3 h-14 w-14 text-muted-foreground/40" />
              <div className="font-medium">{t('noCustomers')}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t('shareQR')}</div>
            </CardContent>
          </Card>
        ) : (
          <ol className="space-y-2">
            {queue.map((ticket, idx) => (
              <li key={ticket.id}>
                <Card className={idx === 0 ? 'ring-2 ring-primary/50' : ''}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="w-14 flex-shrink-0 text-center">
                      <div className="text-xl font-extrabold tabular-nums">{ticketLabel(ticket.number)}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {t('position')} {idx + 1}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{ticket.customerName}</span>
                        {ticket.kind === 'appointment' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                            <CalendarClock className="h-3 w-3" /> {t('appointment')}
                            {ticket.scheduledFor && ` ${formatTime(ticket.scheduledFor, locale, data.timezone)}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {ticket.serviceName && <span>{ticket.serviceName}</span>}
                        <span>· {t('eta', { minutes: ticket.etaMin })}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={idx === 0 ? 'default' : 'outline'}
                        onClick={() => actions.call(ticket)}
                        disabled={busy === ticket.id}
                      >
                        <ChevronRight className="h-4 w-4 rtl:-scale-x-100" /> {t('call')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => actions.cancel(ticket)}
                        disabled={busy === ticket.id}
                        aria-label={t('cancelTicket')}
                        title={t('cancelTicket')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-xs text-muted-foreground">{t('employees', { count: data.activeEmployees })}</p>

      <PauseDialog open={pauseOpen} onClose={() => setPauseOpen(false)} branchId={branchId} />
      <CounterTicketDialog
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        branchId={branchId}
        services={services}
      />
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
