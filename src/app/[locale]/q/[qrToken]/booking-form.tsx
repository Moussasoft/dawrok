'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { dayKeyParts, formatTime } from '@/lib/format';
import { addDaysToKey, dayKey } from '@/lib/time';
import { cn } from '@/lib/utils';
import { rememberTicket } from '@/lib/my-ticket';
import { SmsOptIn, canText, type SmsChannelOffer } from '@/components/sms-opt-in';

type Service = { id: string; name: string; durationMin: number };
type Slot = { time: string; available: boolean };

export function BookingForm({
  qrToken,
  services,
  timezone,
  smsChannel,
}: {
  qrToken: string;
  services: Service[];
  timezone: string;
  smsChannel: SmsChannelOffer | null;
}) {
  const t = useTranslations('publicQueue');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();

  // Les jours sont calculés dans le fuseau de l'agence, pas dans celui du téléphone.
  const days = useMemo(() => {
    const today = dayKey(new Date(), timezone);
    return Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i));
  }, [timezone]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? '');
  const [date, setDate] = useState(days[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingSlots(true);
    const params = new URLSearchParams({ qrToken, date });
    if (serviceId) params.set('serviceId', serviceId);
    apiFetch<{ slots: Slot[] }>(`/api/appointments?${params}`).then((res) => {
      if (!alive) return;
      setSlots(res.ok ? res.data.slots : []);
      setLoadingSlots(false);
    });
    return () => {
      alive = false;
    };
  }, [qrToken, date, serviceId, reload]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) {
      toast.error(t('chooseSlot'));
      return;
    }
    setSubmitting(true);
    const res = await apiFetch<{ publicCode: string }>('/api/appointments', {
      method: 'POST',
      json: {
        qrToken,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        serviceId: serviceId || null,
        scheduledFor: slot,
        locale,
        notifySms: !!smsChannel && notifySms && canText(phone),
      },
    });
    if (!res.ok) {
      setSubmitting(false);
      toast.error(errorMessage(res));
      if (res.error === 'slot_unavailable' || res.error === 'slot_too_soon') {
        setSlot(null);
        setReload((n) => n + 1);
      }
      return;
    }
    rememberTicket(qrToken, res.data.publicCode, slot);
    toast.success(t('bookingDone'));
    router.push(`/t/${res.data.publicCode}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">{t('bookAppointment')}</h2>
      </div>

      {services.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="bk-service">{t('chooseService')}</Label>
          <Select
            id="bk-service"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setSlot(null);
            }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (~{s.durationMin} {tc('min')})
              </option>
            ))}
          </Select>
        </div>
      )}

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t('date')}</legend>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {days.map((d) => {
            const p = dayKeyParts(d, locale);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={date === d}
                onClick={() => {
                  setDate(d);
                  setSlot(null);
                }}
                className={cn(
                  'w-16 flex-shrink-0 rounded-xl border p-2 text-center transition-colors',
                  date === d ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                )}
              >
                <div className="text-[10px] uppercase text-muted-foreground">{p.weekday}</div>
                <div className="text-lg font-bold">{p.day}</div>
                <div className="text-[10px] text-muted-foreground">{p.month}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t('slot')}</legend>
        {loadingSlots ? (
          <div className="grid grid-cols-4 gap-2" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        ) : slots.filter((s) => s.available).length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">{t('noSlots')}</div>
        ) : (
          <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto" dir="ltr">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available}
                aria-pressed={slot === s.time}
                onClick={() => setSlot(s.time)}
                className={cn(
                  'rounded-lg border py-2 text-sm tabular-nums transition-colors',
                  slot === s.time
                    ? 'border-primary bg-primary text-primary-foreground'
                    : s.available
                      ? 'hover:bg-accent'
                      : 'cursor-not-allowed line-through opacity-30'
                )}
              >
                {formatTime(s.time, locale, timezone)}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="bk-name">{t('firstName')} *</Label>
        <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="given-name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bk-phone">{t('phoneRequired')} *</Label>
        <Input
          id="bk-phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          minLength={6}
          maxLength={30}
        />
      </div>
      {smsChannel && <SmsOptIn channel={smsChannel} phone={phone} checked={notifySms} onChange={setNotifySms} />}

      <Button type="submit" size="xl" className="w-full" disabled={submitting || !slot}>
        <Calendar className="h-5 w-5" />
        {submitting ? t('booking') : t('confirmBooking')}
      </Button>
    </form>
  );
}

export function ModeSwitch({ mode, setMode }: { mode: 'now' | 'later'; setMode: (m: 'now' | 'later') => void }) {
  const t = useTranslations('publicQueue');
  return (
    <div role="tablist" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
      {(['now', 'later'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => setMode(m)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors',
            mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {m === 'now' ? <Zap className="h-4 w-4" /> : <Calendar className="h-4 w-4" />} {t(m)}
        </button>
      ))}
    </div>
  );
}
