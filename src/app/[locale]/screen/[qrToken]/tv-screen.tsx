'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Maximize2, Lock, Volume2 } from 'lucide-react';
import { useEventSource } from '@/lib/use-event-source';
import { formatDateTime, formatTime, ticketLabel } from '@/lib/format';
import { isAudioUnlocked, playChime, unlockAudio } from '@/lib/sound';
import type { PublicSnapshot, PublicTicket } from '@/lib/queue-types';

type Props = { qrToken: string; orgName: string; branchName: string; brandColor: string; logoUrl: string | null };

const SPEECH_LANG: Record<string, string> = { ar: 'ar', fr: 'fr', en: 'en' };

function announceKey(t: PublicTicket) {
  return `${t.number}:${t.calledAt}:${t.recallCount}`;
}

/** Voix de synthèse dans la langue de l'écran (repli sur la voix par défaut). */
function speak(text: string, locale: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const prefix = SPEECH_LANG[locale] ?? locale;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? (prefix === 'ar' ? 'ar-SA' : prefix === 'fr' ? 'fr-FR' : 'en-US');
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export function TVScreen({ qrToken, orgName, branchName, brandColor, logoUrl }: Props) {
  const t = useTranslations('tv');
  const locale = useLocale();
  const { data } = useEventSource<PublicSnapshot>(`/api/stream/branch/${qrToken}`, { pauseWhenHidden: false });
  const [now, setNow] = useState(() => Date.now());
  const [soundReady, setSoundReady] = useState(false);
  const announced = useRef<Set<string> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Certaines voix ne sont chargées qu'après un premier appel à getVoices().
  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    setSoundReady(isAudioUnlocked());
  }, []);

  // Annonce (carillon + voix) de chaque nouvel appel ou rappel.
  useEffect(() => {
    if (!data) return;
    const called = data.tickets.filter((x) => x.status === 'called');
    if (announced.current === null) {
      // Premier instantané : on mémorise sans annoncer (évite une rafale à l'ouverture de l'écran).
      announced.current = new Set(called.map(announceKey));
      return;
    }
    const fresh = called.filter((x) => !announced.current!.has(announceKey(x)));
    for (const x of fresh) announced.current.add(announceKey(x));
    if (!fresh.length) return;
    playChime({ volume: 0.4, repeats: 3, gap: 0.25 });
    fresh.forEach((x, i) => {
      const where = x.employeeName ? t('announceTo', { name: x.employeeName }) : t('announceDefault');
      setTimeout(() => speak(t('announce', { number: x.number, where }), locale), 900 + i * 3500);
    });
  }, [data, locale, t]);

  async function enableSound() {
    const ok = await unlockAudio();
    if ('speechSynthesis' in window) {
      // Débloque la synthèse vocale sur les navigateurs qui exigent un geste utilisateur.
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }
    setSoundReady(ok);
  }

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const tz = data?.timezone;
  const called = (data?.tickets.filter((x) => x.status === 'called') ?? []).sort(
    (a, b) => Date.parse(b.calledAt ?? '') - Date.parse(a.calledAt ?? '')
  );
  const current = called[0];
  const otherCalled = called.slice(1, 4);
  const inProgress = data?.tickets.filter((x) => x.status === 'in_progress') ?? [];
  const upcoming = data?.tickets.filter((x) => x.status === 'waiting').slice(0, 6) ?? [];
  const displayName = data?.orgName ?? orgName;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black text-white"
      onClick={soundReady ? undefined : enableSound}
      style={{ ['--accent' as string]: brandColor } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${brandColor}, transparent 60%), radial-gradient(circle at 70% 80%, ${brandColor}aa, transparent 70%)`,
        }}
      />
      <div className="relative flex h-screen flex-col p-8 lg:p-12">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black" style={{ background: brandColor }}>
                {displayName.charAt(0)}
              </div>
            )}
            <div>
              <div className="text-sm uppercase tracking-widest text-white/60">{displayName}</div>
              <div className="text-2xl font-bold lg:text-3xl">{data?.branchName ?? branchName}</div>
            </div>
          </div>
          <div className="text-end">
            <div className="text-3xl font-black tabular-nums lg:text-5xl" suppressHydrationWarning>
              {formatTime(now, locale, tz)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goFullscreen();
              }}
              className="no-print mt-1 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
            >
              <Maximize2 className="h-3 w-3" /> {t('fullscreen')}
            </button>
          </div>
        </header>

        {!data ? (
          <div className="flex flex-1 items-center justify-center text-2xl text-white/60">{t('connecting')}</div>
        ) : data.isPaused ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <Lock className="mx-auto h-32 w-32 text-amber-400" />
              <h1 className="mt-8 text-6xl font-black">{t('closedTitle')}</h1>
              {data.closureReason && <p className="mt-4 text-2xl text-white/70">{data.closureReason}</p>}
              {data.closedUntil && (
                <p className="mt-4 text-xl text-white/50">{t('reopen', { time: formatDateTime(data.closedUntil, locale, tz) })}</p>
              )}
            </div>
          </div>
        ) : (
          <main className="mt-8 grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-3">
            <section className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur lg:col-span-2">
              <div className="text-2xl uppercase tracking-widest text-white/60">{t('now')}</div>
              {current ? (
                <>
                  <div
                    key={announceKey(current)}
                    className="mt-4 animate-pulse text-[12rem] font-black leading-none tabular-nums lg:text-[16rem]"
                    style={{ color: brandColor, textShadow: `0 0 80px ${brandColor}` }}
                  >
                    {ticketLabel(current.number)}
                  </div>
                  {current.employeeName && <div className="mt-2 text-4xl font-semibold">→ {current.employeeName}</div>}
                  {current.serviceName && <div className="mt-3 rounded-full bg-white/10 px-4 py-1 text-lg">{current.serviceName}</div>}
                  {otherCalled.length > 0 && (
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                      {otherCalled.map((x) => (
                        <div key={announceKey(x)} className="rounded-2xl bg-white/10 px-5 py-3 text-center">
                          <div className="text-4xl font-black tabular-nums" style={{ color: brandColor }}>
                            {ticketLabel(x.number)}
                          </div>
                          {x.employeeName && <div className="text-sm text-white/70">→ {x.employeeName}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : inProgress.length ? (
                <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-6">
                  {inProgress.slice(0, 4).map((x) => (
                    <div key={x.number} className="rounded-2xl bg-white/10 p-4 text-center">
                      <div className="text-5xl font-black tabular-nums" style={{ color: brandColor }}>
                        {ticketLabel(x.number)}
                      </div>
                      <div className="mt-1 text-sm text-white/60">{x.employeeName ?? t('inProgress')}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 text-3xl text-white/40">{t('waiting')}</div>
              )}
            </section>

            <aside className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="mb-4 text-xl uppercase tracking-widest text-white/60">{t('upcoming')}</div>
              <div className="flex-1 space-y-3 overflow-hidden">
                {upcoming.length === 0 && <div className="py-8 text-center text-white/40">{t('noTickets')}</div>}
                {upcoming.map((x, i) => (
                  <div
                    key={x.number}
                    className={`flex items-center justify-between rounded-xl p-3 ${i === 0 ? 'border border-white/20 bg-white/15' : 'bg-white/5'}`}
                  >
                    <div>
                      <div className="text-3xl font-black tabular-nums">{ticketLabel(x.number)}</div>
                      {x.serviceName && <div className="text-xs text-white/50">{x.serviceName}</div>}
                    </div>
                    <div className="text-end text-xs text-white/50">{i === 0 ? t('next') : `~${x.etaMin} min`}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <div className="text-sm text-white/60">{t('total', { count: data.waitingCount })}</div>
                <div className="flex items-center gap-2 text-end text-[11px] leading-tight text-white/50">
                  <span className="max-w-[7rem]">{t('scanToJoin')}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/qr/${qrToken}?locale=${locale}`} alt="" width={72} height={72} className="rounded bg-white p-1" />
                </div>
              </div>
            </aside>
          </main>
        )}

        <footer className="mt-6 text-center text-sm text-white/30">
          Daourak{data && ` · ${t('updated', { time: formatTime(data.updatedAt, locale, tz) })}`}
        </footer>
      </div>

      {!soundReady && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <div className="inline-flex animate-pulse items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm backdrop-blur">
            <Volume2 className="h-4 w-4" /> {t('enableSound')}
          </div>
        </div>
      )}
    </div>
  );
}
