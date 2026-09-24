'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Ticket } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { rememberTicket } from '@/lib/my-ticket';

type Service = { id: string; name: string; durationMin: number };

export function TakeTicketForm({ qrToken, services }: { qrToken: string; services: Service[] }) {
  const t = useTranslations('publicQueue');
  const tc = useTranslations('common');
  const router = useRouter();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiFetch<{ publicCode: string }>('/api/tickets', {
      method: 'POST',
      json: { qrToken, customerName: name.trim(), customerPhone: phone.trim() || null, serviceId, locale },
    });
    if (!res.ok) {
      setLoading(false);
      setError(errorMessage(res));
      return;
    }
    rememberTicket(qrToken, res.data.publicCode);
    // Navigation localisée : le client garde sa langue sur la page de suivi.
    router.push(`/t/${res.data.publicCode}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{t('takeTicket')}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="name">{t('firstName')} *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="given-name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('phoneOptional')}</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
        />
      </div>
      {services.length > 1 && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium">{t('chooseService')}</legend>
          <div className="grid grid-cols-1 gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                aria-pressed={serviceId === s.id}
                className={cn(
                  'rounded-lg border p-3 text-start transition-colors',
                  serviceId === s.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                )}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  ~{s.durationMin} {tc('min')}
                </div>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="xl" className="w-full" disabled={loading || !name.trim()}>
        <Ticket className="h-5 w-5" />
        {loading ? t('submitting') : t('takeTicket')}
      </Button>
    </form>
  );
}
