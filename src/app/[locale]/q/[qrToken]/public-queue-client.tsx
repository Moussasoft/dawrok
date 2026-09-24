'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ticket } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { recallTicket } from '@/lib/my-ticket';
import { TakeTicketForm } from './take-ticket-form';
import { BookingForm, ModeSwitch } from './booking-form';

/** Rappel du ticket déjà pris depuis CE navigateur. */
export function MyTicketBanner({ qrToken }: { qrToken: string }) {
  const t = useTranslations('publicQueue');
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => setCode(recallTicket(qrToken)), [qrToken]);
  if (!code) return null;
  return (
    <Link
      href={`/t/${code}`}
      className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm hover:bg-primary/10"
    >
      <span className="flex items-center gap-2 font-medium">
        <Ticket className="h-5 w-5 text-primary" /> {t('myTicket')}
      </span>
      <span className="font-semibold text-primary">{t('viewMyTicket')}</span>
    </Link>
  );
}

type Service = { id: string; name: string; durationMin: number };

export function PublicQueueClient({
  qrToken,
  timezone,
  services,
  canTakeTicket,
  allowBooking,
}: {
  qrToken: string;
  timezone: string;
  services: Service[];
  /** Faux si la file est en pause ou hors horaires : seule la réservation reste possible. */
  canTakeTicket: boolean;
  allowBooking: boolean;
}) {
  const [mode, setMode] = useState<'now' | 'later'>(canTakeTicket ? 'now' : 'later');
  const showSwitch = allowBooking && canTakeTicket;
  const effective = !allowBooking ? 'now' : !canTakeTicket ? 'later' : mode;

  return (
    <div className="space-y-4">
      {showSwitch && <ModeSwitch mode={mode} setMode={setMode} />}
      {effective === 'now' ? (
        <TakeTicketForm qrToken={qrToken} services={services} />
      ) : (
        <BookingForm qrToken={qrToken} services={services} timezone={timezone} />
      )}
    </div>
  );
}
