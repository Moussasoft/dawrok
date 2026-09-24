'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Label, Select } from '@/components/ui/input';
import { useApiCall } from '@/lib/api-client';
import { RETENTION_CHOICES } from '@/lib/retention-rules';

// Loi 09-08 : durée de conservation des données clients (propriétaire), appliquée par la purge quotidienne.
export function PrivacyCard({ retentionDays, canEdit, onRefresh }: { retentionDays: number; canEdit: boolean; onRefresh: () => void }) {
  const t = useTranslations('settings');
  const call = useApiCall();
  const [value, setValue] = useState(retentionDays);
  const [saving, setSaving] = useState(false);

  async function change(next: number) {
    const previous = value;
    setValue(next);
    setSaving(true);
    const ok = await call('/api/settings/org', 'PATCH', { retentionDays: next });
    setSaving(false);
    if (!ok) {
      setValue(previous);
      return;
    }
    toast.success(t('retentionSaved'));
    onRefresh();
  }

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" /> {t('privacyTitle')}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="retention">{t('retention')}</Label>
          <Select
            id="retention"
            value={value}
            disabled={!canEdit || saving}
            onChange={(e) => void change(Number(e.target.value))}
            className="max-w-xs"
          >
            {RETENTION_CHOICES.map((days) => (
              <option key={days} value={days}>
                {t('retentionOption', { days })}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t('retentionHint')}</p>
        </div>
        <Link href="/privacy" target="_blank" className="mt-3 inline-block text-sm text-primary hover:underline">
          {t('privacyPolicyLink')}
        </Link>
      </CardContent>
    </Card>
  );
}
