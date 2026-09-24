'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Lock, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useApiCall } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export type SmsSettings = {
  enabled: boolean;
  channel: string;
  /** Messages inclus par mois dans l'offre (0 = non inclus). */
  quota: number;
  used: number;
  providers: { sms: boolean; whatsapp: boolean };
};

// SMS / WhatsApp : le propriétaire active l'envoi ; les clients qui le demandent sont prévenus.
export function SmsCard({ sms, canEdit, onRefresh }: { sms: SmsSettings; canEdit: boolean; onRefresh: () => void }) {
  const t = useTranslations('settings');
  const call = useApiCall();
  const [saving, setSaving] = useState(false);
  const available = sms.providers.sms || sms.providers.whatsapp;
  const included = sms.quota > 0;

  async function save(patch: { smsEnabled?: boolean; smsChannel?: string }) {
    setSaving(true);
    const ok = await call('/api/settings/org', 'PATCH', patch);
    setSaving(false);
    if (!ok) return;
    toast.success(t('saved'));
    onRefresh();
  }

  const pct = Math.min(100, Math.round((sms.used / Math.max(1, sms.quota)) * 100));
  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" /> {t('smsTitle')}
          </h2>
          {included && available && (
            <Switch
              checked={sms.enabled}
              label={t('smsTitle')}
              disabled={!canEdit || saving}
              onChange={(smsEnabled) => void save({ smsEnabled })}
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('smsDesc')}</p>

        {!included ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> {t('smsNotIncluded')}
          </p>
        ) : !available ? (
          <p className="mt-3 text-sm text-amber-600">{t('smsNotConfigured')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sms-channel">{t('smsChannel')}</Label>
              <Select
                id="sms-channel"
                value={sms.channel}
                disabled={!canEdit || saving}
                onChange={(e) => void save({ smsChannel: e.target.value })}
                className="max-w-xs"
              >
                <option value="sms" disabled={!sms.providers.sms}>
                  {t('smsChannelSms')}
                </option>
                <option value="whatsapp" disabled={!sms.providers.whatsapp}>
                  {t('smsChannelWhatsapp')}
                </option>
              </Select>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{t('smsUsage')}</span>
                <span className="font-medium tabular-nums">{t('usageValue', { used: sms.used, max: sms.quota })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
