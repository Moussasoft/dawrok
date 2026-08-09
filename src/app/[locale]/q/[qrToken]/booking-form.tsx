'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Calendar, Zap } from 'lucide-react';
import { toast } from 'sonner';

type Service = { id: string; name: string; durationMin: number };

export function BookingForm({ qrToken, services }: { qrToken: string; services: Service[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [date, setDate] = useState(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  });
  const [slot, setSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingSlots(true);
    fetch(`/api/appointments?qrToken=${qrToken}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setSlots(d.slots ?? []);
      })
      .finally(() => alive && setLoadingSlots(false));
    return () => {
      alive = false;
    };
  }, [qrToken, date]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) {
      toast.error('Choisissez un créneau');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrToken,
        customerName: name,
        customerPhone: phone,
        serviceId,
        scheduledFor: slot,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data.error || 'Erreur');
      return;
    }
    toast.success('Rendez-vous réservé');
    router.push(`/t/${data.publicCode}`);
  }

  // Next 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-card border p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Réserver à l&apos;avance</h2>
      </div>

      <div className="space-y-1.5">
        <Label>Date</Label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {days.map((d) => {
            const dt = new Date(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDate(d);
                  setSlot(null);
                }}
                className={`flex-shrink-0 rounded-xl border p-2 w-16 text-center transition-colors ${
                  date === d ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                }`}
              >
                <div className="text-[10px] uppercase text-muted-foreground">
                  {dt.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
                <div className="text-lg font-bold">{dt.getDate()}</div>
                <div className="text-[10px] text-muted-foreground">
                  {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Créneau</Label>
        {loadingSlots ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Aucun créneau disponible ce jour-là.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto">
            {slots.map((s) => {
              const t = new Date(s.time);
              const label = t.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setSlot(s.time)}
                  className={`rounded-lg border py-2 text-sm transition-colors ${
                    slot === s.time
                      ? 'border-primary bg-primary text-primary-foreground'
                      : s.available
                        ? 'hover:bg-accent'
                        : 'opacity-30 cursor-not-allowed line-through'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bk-name">Votre prénom *</Label>
        <Input
          id="bk-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bk-phone">Téléphone *</Label>
        <Input
          id="bk-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          maxLength={30}
        />
      </div>
      {services.length > 1 && (
        <div className="space-y-1.5">
          <Label>Prestation</Label>
          <select
            value={serviceId ?? ''}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (~{s.durationMin} min)
              </option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" size="xl" className="w-full" disabled={submitting || !slot}>
        <Calendar className="h-5 w-5" />
        {submitting ? 'Réservation…' : 'Confirmer le rendez-vous'}
      </Button>
    </form>
  );
}

export function ModeSwitch({
  mode,
  setMode,
}: {
  mode: 'now' | 'later';
  setMode: (m: 'now' | 'later') => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-2xl">
      <button
        type="button"
        onClick={() => setMode('now')}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          mode === 'now' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Zap className="h-4 w-4" /> Maintenant
      </button>
      <button
        type="button"
        onClick={() => setMode('later')}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          mode === 'later' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Calendar className="h-4 w-4" /> Plus tard
      </button>
    </div>
  );
}
