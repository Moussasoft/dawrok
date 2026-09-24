'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Ticket } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { ticketLabel } from '@/lib/format';
import { SmsOptIn, canText, type SmsChannelOffer } from '@/components/sms-opt-in';

type Props = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  services: { id: string; name: string }[];
  smsChannel: SmsChannelOffer | null;
};

// Ticket « comptoir » pour les clients sans smartphone : le numéro créé s'affiche en grand.
export function CounterTicketDialog({ open, onClose, branchId, services, smsChannel }: Props) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<number | null>(null);

  function reset() {
    setName('');
    setPhone('');
    setNotifySms(false);
    setCreated(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch<{ number: number }>('/api/dashboard/tickets', {
      method: 'POST',
      json: {
        branchId,
        customerName: name.trim() || undefined,
        customerPhone: phone.trim() || null,
        serviceId: serviceId || null,
        // Langue du client inconnue : celle de l'écran du staff.
        locale,
        notifySms: !!smsChannel && notifySms && canText(phone),
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(errorMessage(res));
      return;
    }
    setCreated(res.data.number);
    toast.success(t('ticketCreated', { number: ticketLabel(res.data.number) }));
  }

  return (
    <Dialog open={open} onClose={close} title={t('addTicketTitle')} description={t('addTicketHint')}>
      {created !== null ? (
        <div className="space-y-6 text-center">
          <div className="rounded-2xl bg-primary/10 py-6">
            <Ticket className="mx-auto h-8 w-8 text-primary" />
            <div className="mt-2 text-7xl font-black tabular-nums text-primary">{ticketLabel(created)}</div>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={close}>
              {tc('close')}
            </Button>
            <Button onClick={reset}>
              <Plus className="h-4 w-4" /> {t('addTicket')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ct-name">
              {t('customerName')} <span className="text-muted-foreground">({tc('optional')})</span>
            </Label>
            <Input id="ct-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-phone">
              {t('customerPhone')} <span className="text-muted-foreground">({tc('optional')})</span>
            </Label>
            <Input id="ct-phone" type="tel" inputMode="tel" dir="ltr" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {smsChannel && (
            <SmsOptIn channel={smsChannel} phone={phone} checked={notifySms} onChange={setNotifySms} label={t('counterSmsConsent')} />
          )}
          {services.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="ct-service">{t('service')}</Label>
              <Select id="ct-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              <Ticket className="h-4 w-4" /> {t('createTicket')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
