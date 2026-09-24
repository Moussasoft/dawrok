'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useApiCall } from '@/lib/api-client';

/** Export (droit d'accès) et suppression (droit à l'effacement) d'une fiche client. */
export function CustomerActions({ id, name }: { id: string; name: string }) {
  const t = useTranslations('customers');
  const router = useRouter();
  const call = useApiCall();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(t('confirmDelete', { name }))) return;
    setBusy(true);
    const ok = await call(`/api/customers/${id}`, 'DELETE');
    setBusy(false);
    if (!ok) return;
    toast.success(t('deleted'));
    router.refresh();
  }

  const iconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent disabled:opacity-50';
  return (
    <div className="flex justify-end gap-1">
      <a href={`/api/customers/${id}/export`} download className={iconButton} aria-label={t('exportData')} title={t('exportData')}>
        <Download className="h-4 w-4" />
      </a>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className={`${iconButton} text-destructive hover:bg-destructive/10`}
        aria-label={t('delete')}
        title={t('delete')}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
