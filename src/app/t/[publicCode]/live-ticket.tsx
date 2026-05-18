'use client';
import { useEffect, useRef, useState } from 'react';
import { useEventSource } from '@/lib/use-event-source';
import { ClientTicketView } from '@/components/client-ticket-view';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, X, Share2, Volume2, VolumeX, Lock, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

type Payload = {
  ticket: {
    id: string;
    publicCode: string;
    number: number;
    status: string;
    position: number;
    etaMin: number;
  } | null;
  totalAhead: number;
  nowServing: number;
  branchName: string;
  orgName: string;
  brandColor: string;
  logoUrl: string | null;
  closedUntil: string | null;
  closureReason: string | null;
  isPaused: boolean;
  cancelToken: string | null;
  scheduledFor: string | null;
};

/** Compte à rebours jusqu'à une date ISO. */
function Countdown({ target }: { target: string }) {
  const [diff, setDiff] = useState(() => Math.max(0, new Date(target).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(Math.max(0, new Date(target).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (diff <= 0) return <span className="text-success font-semibold">C’est l’heure !</span>;

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0 || days > 0) parts.push(`${String(hours).padStart(2, '0')}h`);
  parts.push(`${String(mins).padStart(2, '0')}m`);
  parts.push(`${String(secs).padStart(2, '0')}s`);

  return <span className="font-mono tabular-nums text-3xl font-bold">{parts.join(' ')}</span>;
}

export function LiveTicket({ publicCode }: { publicCode: string }) {
  const { data, connected } = useEventSource<Payload>(`/api/stream/ticket/${publicCode}`);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [soundOn, setSoundOn] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const lastNotifiedRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  function playBeep() {
    if (!soundOn) return;
    try {
      const Ctx =
        typeof window !== 'undefined'
          ? (window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
          : null;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      [0, 0.18, 0.36].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(880, now + t);
        osc.frequency.exponentialRampToValueAtTime(1320, now + t + 0.12);
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.25, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.18);
      });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!data?.ticket) return;
    const t = data.ticket;
    const key = `${t.status}:${data.totalAhead}`;
    if (lastNotifiedRef.current === key) return;

    if (t.status === 'called' && lastNotifiedRef.current.split(':')[0] !== 'called') {
      try { navigator.vibrate?.([300, 120, 300, 120, 300]); } catch { /* */ }
      playBeep();
      toast.success("C'est votre tour !", { description: "Présentez-vous à l'accueil" });
      if (notifPerm === 'granted') {
        new Notification("C'est votre tour !", {
          body: `Présentez-vous à l'accueil — ${data.branchName}`,
        });
      }
    } else if (t.status === 'waiting' && lastNotifiedRef.current.startsWith('scheduled:')) {
      // Transition scheduled → waiting : l'heure du RDV est arrivée
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
      playBeep();
      toast.success('Votre rendez-vous commence !', { description: "Vous êtes maintenant en file d'attente." });
      if (notifPerm === 'granted') {
        new Notification('Votre rendez-vous commence !', {
          body: `Vous êtes en file d'attente — ${data.branchName}`,
        });
      }
    } else if (t.status === 'waiting' && data.totalAhead === 2) {
      try {
        navigator.vibrate?.([100, 50, 100]);
      } catch {
        /* */
      }
      playBeep();
      toast('Votre tour approche', { description: 'Plus que 2 personnes avant vous.' });
      if (notifPerm === 'granted') {
        new Notification('Votre tour approche', {
          body: 'Plus que 2 personnes avant vous.',
        });
      }
    }
    lastNotifiedRef.current = key;
  }, [data, notifPerm, soundOn]);

  async function enableNotif() {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === 'granted') toast.success('Notifications activées');
  }

  async function cancelTicket() {
    if (!data?.cancelToken) return;
    if (!confirm("Confirmer l'annulation de votre ticket ?")) return;
    setCancelling(true);
    const r = await fetch(`/api/tickets/cancel/${data.cancelToken}`, { method: 'POST' });
    setCancelling(false);
    if (r.ok) toast.success('Ticket annulé');
    else toast.error('Annulation impossible');
  }

  function shareWhatsApp() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const text = `Mon ticket pour ${data?.branchName ?? ''} — suivez en direct : ${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank');
  }

  async function shareNative() {
    type ShareNav = Navigator & { share?: (d: { url: string; text?: string }) => Promise<void> };
    const nav = typeof navigator !== 'undefined' ? (navigator as ShareNav) : null;
    if (nav?.share) {
      try {
        await nav.share({
          url: window.location.href,
          text: `Mon ticket pour ${data?.branchName ?? ''}`,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      shareWhatsApp();
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-card border p-8 space-y-3">
        <div className="skeleton h-8 w-1/2 mx-auto" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-4 w-3/4 mx-auto" />
      </div>
    );
  }

  if (data.isPaused) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-6 text-center">
        <Lock className="h-8 w-8 mx-auto text-amber-600" />
        <h3 className="mt-3 font-bold text-lg">File temporairement fermée</h3>
        {data.closureReason && <p className="text-sm mt-1">{data.closureReason}</p>}
        {data.closedUntil && (
          <p className="text-xs text-muted-foreground mt-2">
            Réouverture prévue : {new Date(data.closedUntil).toLocaleString('fr-FR')}
          </p>
        )}
      </div>
    );
  }

  if (!data.ticket) {
    return (
      <div className="rounded-2xl bg-card border p-8 text-center">
        <p className="text-muted-foreground">Ce ticket n'est plus actif.</p>
      </div>
    );
  }

  const t = data.ticket;
  const canCancel = !!data.cancelToken && ['waiting', 'called', 'scheduled'].includes(t.status);

  // ── Vue spéciale pour les RDV en attente d'activation ──────────────────────
  if (t.status === 'scheduled' && data.scheduledFor) {
    const dtLabel = new Date(data.scheduledFor).toLocaleString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    return (
      <div className="rounded-2xl bg-card border p-6 shadow-sm space-y-5">
        <div className="text-center">
          <CalendarClock className="h-10 w-10 mx-auto text-primary mb-3" />
          <h2 className="text-xl font-bold mb-1">Rendez-vous confirmé</h2>
          <p className="text-sm text-muted-foreground capitalize">{dtLabel}</p>
        </div>
        <div className="rounded-xl bg-muted px-4 py-4 text-center">
          <div className="text-xs uppercase text-muted-foreground mb-1">Votre ticket sera activé dans</div>
          <Countdown target={data.scheduledFor} />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Gardez cette page ouverte. Vous serez notifié automatiquement dès que votre tour dans la file est proche.
        </p>
        <div className="space-y-2">
          {notifPerm !== 'granted' && (
            <Button variant="outline" onClick={enableNotif} className="w-full">
              <Bell className="h-4 w-4" /> Activer les notifications
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              onClick={cancelTicket}
              disabled={cancelling}
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <X className="h-4 w-4" /> {cancelling ? 'Annulation…' : 'Annuler le rendez-vous'}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} />
          {connected ? 'Surveillance active' : 'Reconnexion…'}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border p-6 shadow-sm">
      <ClientTicketView
        position={t.position}
        totalAhead={data.totalAhead}
        nowServing={data.nowServing}
        etaMin={t.etaMin}
        status={t.status}
      />
      <div className="mt-6 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {notifPerm !== 'granted' && t.status === 'waiting' ? (
            <Button variant="outline" onClick={enableNotif} className="w-full">
              <Bell className="h-4 w-4" /> Notifier
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setSoundOn((v) => !v)}
              className="w-full"
              type="button"
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              Son {soundOn ? 'ON' : 'OFF'}
            </Button>
          )}
          <Button variant="outline" onClick={shareNative} className="w-full">
            <Share2 className="h-4 w-4" /> Partager
          </Button>
        </div>
        {canCancel && (
          <Button
            variant="outline"
            onClick={cancelTicket}
            disabled={cancelling}
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <X className="h-4 w-4" /> {cancelling ? 'Annulation…' : 'Annuler mon ticket'}
          </Button>
        )}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} />
          {connected ? 'Mise à jour en temps réel' : 'Reconnexion…'}
          {notifPerm === 'denied' && (
            <>
              <span>·</span>
              <BellOff className="h-3 w-3" /> Notifs bloquées
            </>
          )}
        </div>
      </div>
    </div>
  );
}
