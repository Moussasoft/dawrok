'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  position: number; // 0 = c'est votre tour
  totalAhead: number;
  nowServing?: number;
  etaMin: number;
  status: string;
};

export function ClientTicketView({ position, totalAhead, nowServing = 0, etaMin, status }: Props) {
  // Animate the "personnes avant vous" count smoothly when it changes.
  const [displayCount, setDisplayCount] = useState(totalAhead);
  const [pulse, setPulse] = useState(false);
  const prevRef = useRef(totalAhead);

  useEffect(() => {
    if (totalAhead === prevRef.current) return;
    const from = prevRef.current;
    const to = totalAhead;
    prevRef.current = to;
    setPulse(true);
    const stepDir = to > from ? 1 : -1;
    let current = from;
    const tick = () => {
      current += stepDir;
      setDisplayCount(current);
      if (current !== to) {
        timer = setTimeout(tick, 120);
      } else {
        setTimeout(() => setPulse(false), 200);
      }
    };
    let timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [totalAhead]);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [status]);

  const isYourTurn = status === 'called' || (status === 'waiting' && position === 0);
  const isInProgress = status === 'in_progress';
  const isDone = status === 'done';
  const isCancelled = status === 'cancelled' || status === 'no_show';

  if (isDone) {
    return (
      <div className="text-center py-8">
        <div className="text-7xl mb-4">✓</div>
        <h2 className="text-2xl font-bold mb-2">Service terminé</h2>
        <p className="text-muted-foreground">Merci de votre visite !</p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">⊘</div>
        <h2 className="text-2xl font-bold mb-2">Ticket annulé</h2>
      </div>
    );
  }

  if (isYourTurn) {
    return (
      <div className="text-center py-6 animate-pulse-soft">
        <div className="inline-block px-6 py-3 bg-success text-success-foreground rounded-2xl text-3xl font-extrabold mb-4">
          C'est votre tour !
        </div>
        <p className="text-lg text-muted-foreground">Présentez-vous à l'accueil</p>
      </div>
    );
  }

  if (isInProgress) {
    return (
      <div className="text-center py-6">
        <div className="text-2xl font-semibold text-primary mb-2">En cours de service</div>
        <p className="text-muted-foreground">Votre service est en cours.</p>
      </div>
    );
  }

  // waiting
  return (
    <div className="text-center py-4">
      <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Personnes avant vous</div>
      <div
        className={cn(
          'text-8xl font-extrabold tabular-nums transition-all duration-300',
          pulse && 'scale-110 text-primary'
        )}
      >
        {displayCount}
      </div>
      {nowServing > 0 && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {nowServing === 1 ? "1 client en cours de service" : `${nowServing} clients en cours de service`}
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 text-left">
        <div className="rounded-xl bg-muted p-4">
          <div className="text-xs uppercase text-muted-foreground">Position</div>
          <div className="text-2xl font-bold">{position + 1}</div>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <div className="text-xs uppercase text-muted-foreground">Temps estimé</div>
          <div className="text-2xl font-bold">~{etaMin} min</div>
        </div>
      </div>
    </div>
  );
}
