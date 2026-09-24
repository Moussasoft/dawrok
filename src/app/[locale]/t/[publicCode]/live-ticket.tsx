'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bell, BellOff, BellRing, X, Share2, Volume2, VolumeX, Lock, CalendarClock, CheckCircle2, Ban, UserX } from 'lucide-react';
import { useEventSource } from '@/lib/use-event-source';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { formatDateTime, formatLongDateTime, ticketLabel } from '@/lib/format';
import { playChime, unlockAudio, vibrate } from '@/lib/sound';
import {
  enableTicketNotifications,
  isIosWithoutPwa,
  notificationsSupported,
  pushSupported,
  showLocalNotification,
  syncExistingSubscription,
} from '@/lib/push-client';
import type { TicketView } from '@/lib/queue-types';
import { WaitingView } from '@/components/client-ticket-view';
import { Button } from '@/components/ui/button';

type NotifState = 'off' | 'local' | 'push' | 'denied' | 'unsupported';

/** Compte à rebours jusqu'au rendez-vous (jj + hh:mm:ss). */
function Countdown({ target }: { target: string }) {
  const t = useTranslations('ticket');
  const [diff, setDiff] = useState(() => Math.max(0, Date.parse(target) - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, Date.parse(target) - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (diff <= 0) return <span className="font-semibold text-success">{t('itsTime')}</span>;
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return (
    <span className="font-mono text-3xl font-bold tabular-nums" dir="ltr">
      {days > 0 && `${t('countdownDays', { days })} `}
      {clock}
    </span>
  );
}

export function LiveTicket({ publicCode, initial }: { publicCode: string; initial: TicketView }) {
  const t = useTranslations('ticket');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  // Pas de coupure en arrière-plan : il faut continuer à recevoir les mises à jour pour prévenir le client.
  const { data: live, connected } = useEventSource<TicketView>(`/api/stream/ticket/${publicCode}`, {
    pauseWhenHidden: false,
  });
  const view = live ?? initial;
  const tk = view.ticket;
  const tz = view.branch.timezone;

  const [notif, setNotif] = useState<NotifState>('off');
  const [soundOn, setSoundOn] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const prevRef = useRef<TicketView['ticket'] | null>(null);
  const soundRef = useRef(soundOn);
  const notifRef = useRef(notif);
  soundRef.current = soundOn;
  notifRef.current = notif;

  // Le son doit être débloqué par un geste de l'utilisateur (politique autoplay des navigateurs).
  useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!notificationsSupported()) {
      setNotif('unsupported');
      return;
    }
    if (Notification.permission === 'denied') setNotif('denied');
    else if (Notification.permission === 'granted') {
      // Seul un ticket encore actif peut être (ré)abonné côté serveur.
      if (['scheduled', 'waiting', 'called'].includes(initial.ticket.status)) {
        // Pas encore d'abonnement push alors que c'est possible : on laisse le bouton « Me notifier ».
        void syncExistingSubscription(publicCode, locale).then((r) =>
          setNotif(r === 'push' ? 'push' : pushSupported() ? 'off' : 'local')
        );
      } else {
        setNotif('local');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule synchronisation au chargement
  }, []);

  // Alertes sur changement d'état (le 1er rendu n'alerte pas).
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = tk;
    if (!prev) return;

    const alert = (title: string, body: string, strong: boolean) => {
      if (soundRef.current) playChime({ volume: strong ? 0.35 : 0.2, repeats: strong ? 3 : 2 });
      vibrate(strong ? [300, 120, 300, 120, 300] : [120, 60, 120]);
      if (strong) toast.success(title, { description: body, duration: 10_000 });
      else toast(title, { description: body });
      // Avec le push serveur, le service worker affiche déjà la notification : pas de doublon.
      if (document.hidden && notifRef.current === 'local') void showLocalNotification(title, body, `ticket-${publicCode}`);
    };

    // Nouvel appel (calledAt change) ou rappel (recallCount change) — pas un simple retour arrière du staff.
    if (tk.status === 'called' && (prev.calledAt !== tk.calledAt || prev.recallCount !== tk.recallCount)) {
      alert(t('yourTurn'), tk.employeeName ? t('goTo', { where: tk.employeeName }) : t('goToCounter'), true);
    } else if (tk.status === 'waiting' && prev.status === 'scheduled') {
      alert(t('appointmentStartedToast'), t('appointmentStartedDesc'), false);
    } else if (tk.status === 'waiting' && prev.status === 'waiting' && prev.peopleAhead > 2 && tk.peopleAhead <= 2) {
      alert(t('soonToast'), t('soonToastDesc', { count: tk.peopleAhead }), false);
    }
  }, [tk, t, publicCode]);

  async function enableNotifications() {
    await unlockAudio();
    const result = await enableTicketNotifications(publicCode, locale);
    const next: NotifState = result === 'push' ? 'push' : result === 'local' ? 'local' : result;
    setNotif(next);
    if (next === 'push' || next === 'local') toast.success(t('notificationsOn'));
    else if (next === 'denied') toast.error(t('notificationsBlocked'));
  }

  async function cancel() {
    if (!view.cancelToken || !confirm(t('confirmCancel'))) return;
    setCancelling(true);
    const res = await apiFetch(`/api/tickets/cancel/${view.cancelToken}`, { method: 'POST' });
    setCancelling(false);
    if (res.ok) toast.success(t('cancelledToast'));
    else toast.error(errorMessage(res));
  }

  async function share() {
    const url = window.location.href;
    const text = `${t('shareText', { branch: view.branch.branchName })} ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, text: t('shareText', { branch: view.branch.branchName }) });
        return;
      } catch {
        /* partage annulé */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  const isActive = ['scheduled', 'waiting', 'called'].includes(tk.status);
  const showNotifyButton = isActive && (notif === 'off' || notif === 'unsupported');

  return (
    <div className="space-y-4">
      {/* Carte ticket */}
      <div className="rounded-3xl border bg-card p-6 text-center shadow-md">
        {view.branch.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.branch.logoUrl} alt="" className="mx-auto mb-2 h-12 w-12 rounded-xl object-contain" />
        )}
        <div className="text-sm text-muted-foreground">{view.branch.orgName}</div>
        <div className="text-base font-medium">{view.branch.branchName}</div>
        <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">{t('yourTicket')}</div>
        {tk.status === 'scheduled' ? (
          <CalendarClock className="mx-auto my-3 h-14 w-14 text-primary" />
        ) : (
          <div className="my-2 text-6xl font-extrabold tabular-nums text-primary">{ticketLabel(tk.number)}</div>
        )}
        <div className="text-sm text-muted-foreground">{tk.customerName}</div>
        {tk.serviceName && (
          <div className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            {tk.serviceName}
          </div>
        )}
      </div>

      {view.branch.isPaused && isActive && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">{t('paused')}</div>
            {view.branch.closureReason && <div>{view.branch.closureReason}</div>}
            {view.branch.closedUntil && (
              <div className="text-xs text-muted-foreground">
                {t('reopenPlanned', { time: formatDateTime(view.branch.closedUntil, locale, tz) })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {tk.status === 'scheduled' && tk.scheduledFor && (
          <div className="space-y-5 text-center">
            <div>
              <h2 className="mb-1 text-xl font-bold">{t('appointmentConfirmed')}</h2>
              <p className="text-sm capitalize text-muted-foreground">{formatLongDateTime(tk.scheduledFor, locale, tz)}</p>
            </div>
            <div className="rounded-xl bg-muted px-4 py-4">
              <div className="mb-1 text-xs uppercase text-muted-foreground">{t('activatesIn')}</div>
              <Countdown target={tk.scheduledFor} />
            </div>
            <p className="text-xs text-muted-foreground">{t('appointmentHint')}</p>
          </div>
        )}
        {tk.status === 'waiting' && <WaitingView peopleAhead={tk.peopleAhead} etaMin={tk.etaMin} nowServing={view.nowServing} />}
        {tk.status === 'called' && (
          <div className="animate-pulse-soft py-6 text-center">
            <div className="mb-4 inline-block rounded-2xl bg-success px-6 py-3 text-3xl font-extrabold text-success-foreground">
              {t('yourTurn')}
            </div>
            <p className="text-lg text-muted-foreground">
              {tk.employeeName ? t('goTo', { where: tk.employeeName }) : t('goToCounter')}
            </p>
          </div>
        )}
        {tk.status === 'in_progress' && (
          <div className="py-6 text-center">
            <div className="mb-2 text-2xl font-semibold text-primary">{t('inProgress')}</div>
            <p className="text-muted-foreground">{t('inProgressDesc')}</p>
          </div>
        )}
        {tk.status === 'done' && (
          <FinalState icon={<CheckCircle2 className="h-16 w-16 text-success" />} title={t('done')} desc={t('thanks')} />
        )}
        {tk.status === 'cancelled' && <FinalState icon={<Ban className="h-14 w-14 text-muted-foreground" />} title={t('cancelled')} />}
        {tk.status === 'no_show' && (
          <FinalState icon={<UserX className="h-14 w-14 text-muted-foreground" />} title={t('noShow')} desc={t('noShowDesc')} />
        )}

        {isActive && (
          <div className="mt-6 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {showNotifyButton ? (
                <Button variant="outline" onClick={enableNotifications} className="w-full" disabled={notif === 'unsupported'}>
                  <Bell className="h-4 w-4" /> {t('notifyMe')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    void unlockAudio();
                    setSoundOn((v) => !v);
                  }}
                  className="w-full"
                  aria-pressed={soundOn}
                >
                  {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  {soundOn ? t('soundOn') : t('soundOff')}
                </Button>
              )}
              <Button variant="outline" onClick={share} className="w-full">
                <Share2 className="h-4 w-4" /> {t('share')}
              </Button>
            </div>
            {view.cancelToken && (
              <Button
                variant="outline"
                onClick={cancel}
                disabled={cancelling}
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
                {cancelling ? t('cancelling') : tk.status === 'scheduled' ? t('cancelAppointment') : t('cancelTicket')}
              </Button>
            )}
            {notif === 'unsupported' && isIosWithoutPwa() && (
              <p className="text-center text-xs text-muted-foreground">{t('notificationsUnsupported')}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} />
          {connected ? (tk.status === 'scheduled' ? t('watching') : t('live')) : t('reconnecting')}
          {notif === 'push' && (
            <>
              <span>·</span>
              <BellRing className="h-3 w-3" /> {t('notificationsOn')}
            </>
          )}
          {notif === 'denied' && (
            <>
              <span>·</span>
              <BellOff className="h-3 w-3" /> {t('notificationsBlocked')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FinalState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="py-8 text-center">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      {desc && <p className="text-muted-foreground">{desc}</p>}
    </div>
  );
}
