'use client';
import { useEffect, useRef, useState } from 'react';
import { useEventSource } from '@/lib/use-event-source';
import { Maximize2, Lock } from 'lucide-react';
import Image from 'next/image';

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
  }>;
};

type Props = {
  qrToken: string;
  orgName: string;
  branchName: string;
  brandColor: string;
  logoUrl: string | null;
};

export function TVScreen({ qrToken, brandColor, logoUrl }: Props) {
  const { data } = useEventSource<Snapshot>(`/api/stream/branch/${qrToken}`);
  const [time, setTime] = useState('');
  const lastCalledRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      );
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);

  // Bell + voice on new "called" ticket
  useEffect(() => {
    if (!data) return;
    const calling = data.tickets.find((t) => t.status === 'called');
    if (!calling) return;
    if (lastCalledRef.current === calling.number) return;
    lastCalledRef.current = calling.number;
    try {
      const Ctx =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;
      if (Ctx) {
        const ctx = new Ctx();
        const now = ctx.currentTime;
        [0, 0.25, 0.5].forEach((t) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(880, now + t);
          osc.frequency.exponentialRampToValueAtTime(1320, now + t + 0.18);
          gain.gain.setValueAtTime(0, now + t);
          gain.gain.linearRampToValueAtTime(0.4, now + t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.22);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + 0.22);
        });
      }
      // Voice (browser TTS) — French
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(
          `Numéro ${calling.number}, ${
            calling.employeeName ? `chez ${calling.employeeName}` : 'à l\u2019accueil'
          }`
        );
        u.lang = 'fr-FR';
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* */
    }
  }, [data]);

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-2xl">
        Connexion…
      </div>
    );
  }

  const called = data.tickets.find((t) => t.status === 'called');
  const inProgress = data.tickets.filter((t) => t.status === 'in_progress');
  const upcoming = data.tickets.filter((t) => t.status === 'waiting').slice(0, 6);

  return (
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{ ['--accent' as string]: brandColor } as React.CSSProperties}
    >
      {/* Bg gradient */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${brandColor}, transparent 60%), radial-gradient(circle at 70% 80%, ${brandColor}aa, transparent 70%)`,
        }}
      />
      <div className="relative h-screen flex flex-col p-8 lg:p-12">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <Image src={logoUrl} alt="" width={56} height={56} className="rounded-xl bg-white p-1" />
            ) : (
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center font-black text-2xl"
                style={{ background: brandColor }}
              >
                {data.orgName.charAt(0)}
              </div>
            )}
            <div>
              <div className="text-sm uppercase tracking-widest text-white/60">{data.orgName}</div>
              <div className="text-2xl lg:text-3xl font-bold">{data.branchName}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl lg:text-5xl font-black tabular-nums">{time}</div>
            <button
              onClick={goFullscreen}
              className="mt-1 text-xs text-white/50 hover:text-white inline-flex items-center gap-1 no-print"
            >
              <Maximize2 className="h-3 w-3" /> Plein écran
            </button>
          </div>
        </header>

        {data.isPaused ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Lock className="h-32 w-32 mx-auto text-amber-400" />
              <h1 className="mt-8 text-6xl font-black">FILE FERMÉE</h1>
              {data.closureReason && (
                <p className="mt-4 text-2xl text-white/70">{data.closureReason}</p>
              )}
              {data.closedUntil && (
                <p className="mt-4 text-xl text-white/50">
                  Réouverture : {new Date(data.closedUntil).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 min-h-0">
            {/* Now serving */}
            <section className="lg:col-span-2 flex flex-col items-center justify-center rounded-3xl bg-white/5 backdrop-blur border border-white/10 p-8">
              <div className="text-2xl uppercase tracking-widest text-white/60">Maintenant</div>
              {called ? (
                <>
                  <div
                    className="mt-4 text-[14rem] lg:text-[18rem] font-black leading-none tabular-nums animate-pulse"
                    style={{ color: brandColor, textShadow: `0 0 80px ${brandColor}` }}
                  >
                    {String(called.number).padStart(3, '0')}
                  </div>
                  {called.employeeName && (
                    <div className="text-3xl mt-2">→ {called.employeeName}</div>
                  )}
                  {called.serviceName && (
                    <div className="mt-2 px-4 py-1 rounded-full bg-white/10 text-lg">
                      {called.serviceName}
                    </div>
                  )}
                </>
              ) : inProgress.length ? (
                <div className="mt-6 grid grid-cols-2 gap-6 w-full max-w-2xl">
                  {inProgress.slice(0, 4).map((t) => (
                    <div key={t.id} className="rounded-2xl bg-white/10 p-4 text-center">
                      <div className="text-5xl font-black tabular-nums" style={{ color: brandColor }}>
                        #{String(t.number).padStart(3, '0')}
                      </div>
                      <div className="text-sm text-white/60 mt-1">
                        {t.employeeName ?? 'En cours'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 text-3xl text-white/40">— en attente —</div>
              )}
            </section>

            {/* Up next */}
            <aside className="rounded-3xl bg-white/5 backdrop-blur border border-white/10 p-6 flex flex-col">
              <div className="text-xl uppercase tracking-widest text-white/60 mb-4">Prochains</div>
              <div className="flex-1 space-y-3 overflow-hidden">
                {upcoming.length === 0 && (
                  <div className="text-white/40 text-center py-8">Aucun ticket</div>
                )}
                {upcoming.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between rounded-xl p-3 ${
                      i === 0 ? 'bg-white/15 border border-white/20' : 'bg-white/5'
                    }`}
                  >
                    <div>
                      <div className="text-3xl font-black tabular-nums">
                        #{String(t.number).padStart(3, '0')}
                      </div>
                      {t.serviceName && (
                        <div className="text-xs text-white/50">{t.serviceName}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/50">
                        {i === 0 ? 'Suivant' : `~${t.etaMin} min`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40 text-center">
                Total en file : <span className="font-bold">{upcoming.length}</span>
              </div>
            </aside>
          </main>
        )}

        <footer className="mt-6 text-center text-white/30 text-sm">
          Daourak · Mise à jour {new Date(data.updatedAt).toLocaleTimeString('fr-FR')}
        </footer>
      </div>
    </div>
  );
}
