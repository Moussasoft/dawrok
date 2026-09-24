'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pause } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const PRESETS = [15, 30, 60, 120];

export function PauseDialog({ open, onClose, branchId }: { open: boolean; onClose: () => void; branchId: string }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState(() => t('pauseReasonDefault'));
  const [saving, setSaving] = useState(false);

  const effective = custom ? Number(custom) : minutes;
  const valid = Number.isInteger(effective) && effective > 0 && effective <= 24 * 60;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const res = await apiFetch(`/api/branches/${branchId}/closure`, {
      method: 'PATCH',
      json: { closedUntil: new Date(Date.now() + effective * 60_000).toISOString(), reason: reason.trim() || null },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(errorMessage(res));
      return;
    }
    toast.success(t('pausedFor', { minutes: effective }));
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('pauseTitle')} description={t('pauseHint')}>
      <form onSubmit={submit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('pauseDuration')}</legend>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMinutes(m);
                  setCustom('');
                }}
                aria-pressed={!custom && minutes === m}
                className={cn(
                  'rounded-lg border py-2 text-sm font-medium transition-colors',
                  !custom && minutes === m ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {m < 60 ? `${m} ${t('min')}` : `${m / 60} h`}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="pause-custom">{t('pauseCustom')}</Label>
          <Input
            id="pause-custom"
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pause-reason">{t('pauseReason')}</Label>
          <Input id="pause-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            <Pause className="h-4 w-4" /> {t('pauseConfirm')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
