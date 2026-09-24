'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Props = {
  /** Personnes en attente devant le client (0 = il est le prochain). */
  peopleAhead: number;
  etaMin: number;
  nowServing: number;
};

// Vue « en attente » : le compteur s'anime quand il diminue.
export function WaitingView({ peopleAhead, etaMin, nowServing }: Props) {
  const t = useTranslations('ticket');
  const [display, setDisplay] = useState(peopleAhead);
  const [pulse, setPulse] = useState(false);
  const prevRef = useRef(peopleAhead);

  useEffect(() => {
    const from = prevRef.current;
    const to = peopleAhead;
    if (from === to) return;
    prevRef.current = to;
    setPulse(true);
    const step = to > from ? 1 : -1;
    let current = from;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      current += step;
      setDisplay(current);
      if (current !== to) timer = setTimeout(tick, 120);
      else timer = setTimeout(() => setPulse(false), 250);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [peopleAhead]);

  if (peopleAhead === 0) {
    return (
      <div className="py-4 text-center">
        <div className="mb-3 inline-block rounded-2xl bg-primary/10 px-5 py-2 text-2xl font-extrabold text-primary">
          {t('youAreNext')}
        </div>
        <p className="text-muted-foreground">{t('youAreNextDesc')}</p>
        {nowServing > 0 && <NowServing count={nowServing} />}
      </div>
    );
  }

  return (
    <div className="py-4 text-center">
      <div className="mb-2 text-sm uppercase tracking-wider text-muted-foreground">{t('peopleAhead')}</div>
      <div
        aria-live="polite"
        className={cn('text-8xl font-extrabold tabular-nums transition-all duration-300', pulse && 'scale-110 text-primary')}
      >
        {display}
      </div>
      {nowServing > 0 && <NowServing count={nowServing} />}
      <div className="mt-6 grid grid-cols-2 gap-3 text-start">
        <div className="rounded-xl bg-muted p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('position')}</div>
          <div className="text-2xl font-bold tabular-nums">{peopleAhead + 1}</div>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('eta')}</div>
          <div className="text-2xl font-bold tabular-nums">{t('etaValue', { minutes: etaMin })}</div>
        </div>
      </div>
    </div>
  );
}

function NowServing({ count }: { count: number }) {
  const t = useTranslations('ticket');
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      {t('nowServing', { count })}
    </div>
  );
}
