'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImagePlus, Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/lib/api-client';

type Props = { logoUrl: string | null; orgName: string; allowed: boolean; canEdit: boolean; onChange: () => void };

export function LogoUploader({ logoUrl, orgName, allowed, canEdit, onChange }: Props) {
  const t = useTranslations('settings');
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    body.append('logo', file);
    const res = await fetch('/api/settings/logo', { method: 'POST', body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => ({}))) as { error?: string };
      toast.error(errorMessage({ error: data.error ?? (res ? 'generic' : 'network'), details: data as Record<string, unknown> }));
      return;
    }
    toast.success(t('logoUpdated'));
    onChange();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch('/api/settings/logo', { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success(t('logoRemoved'));
      onChange();
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={orgName} className="h-full w-full object-contain" />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">{orgName.charAt(0)}</span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium">{t('logo')}</div>
        {!allowed ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {t('brandLocked')}
          </p>
        ) : canEdit ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
                <ImagePlus className="h-3.5 w-3.5" /> {t('logoUpload')}
              </Button>
              {logoUrl && (
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>
                  <Trash2 className="h-3.5 w-3.5" /> {t('logoRemove')}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('logoHint')}</p>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(file);
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
