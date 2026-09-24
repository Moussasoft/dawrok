'use client';
import { useTranslations } from 'next-intl';
import { MessageSquare } from 'lucide-react';
import { isTextable, toE164 } from '@/lib/phone';
import { cn } from '@/lib/utils';

export type SmsChannelOffer = 'sms' | 'whatsapp';

/** Le numéro saisi peut-il recevoir un SMS ? */
export function canText(phone: string): boolean {
  return isTextable(toE164(phone));
}

// Consentement explicite du client pour être prévenu par SMS / WhatsApp (numéro mobile requis).
export function SmsOptIn({
  channel,
  phone,
  checked,
  onChange,
  label,
}: {
  channel: SmsChannelOffer;
  phone: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  /** Libellé propre au contexte (ex. ticket comptoir, où le staff recueille l'accord). */
  label?: string;
}) {
  const t = useTranslations('publicQueue');
  const valid = canText(phone);
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', !valid && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        checked={checked && valid}
        disabled={!valid}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
      />
      <span>
        <span className="flex items-center gap-1.5 font-medium">
          <MessageSquare className="h-4 w-4 text-primary" />
          {label ?? (channel === 'whatsapp' ? t('notifyWhatsapp') : t('notifySms'))}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{valid ? t('notifySmsHint') : t('notifySmsNeedPhone')}</span>
      </span>
    </label>
  );
}
