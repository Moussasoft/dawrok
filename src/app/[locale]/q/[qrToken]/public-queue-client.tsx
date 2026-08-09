'use client';
import { useState } from 'react';
import { TakeTicketForm } from './take-ticket-form';
import { BookingForm, ModeSwitch } from './booking-form';

type Service = { id: string; name: string; durationMin: number };

export function PublicQueueClient({
  qrToken,
  services,
  allowBooking,
}: {
  qrToken: string;
  services: Service[];
  allowBooking: boolean;
}) {
  const [mode, setMode] = useState<'now' | 'later'>('now');
  return (
    <div className="space-y-4">
      {allowBooking && <ModeSwitch mode={mode} setMode={setMode} />}
      {mode === 'now' || !allowBooking ? (
        <TakeTicketForm qrToken={qrToken} services={services} />
      ) : (
        <BookingForm qrToken={qrToken} services={services} />
      )}
    </div>
  );
}
