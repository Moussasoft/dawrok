'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pause, Play, LogIn, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { apiFetch, useErrorMessage } from '@/lib/api-client';

const PLANS = ['free', 'starter', 'pro', 'business'] as const;

export function OrgRowActions({ orgId, orgName, suspended }: { orgId: string; orgName: string; suspended: boolean }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function run(url: string, method: string, json?: unknown) {
    setBusy(true);
    const res = await apiFetch(url, { method, json });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorMessage(res));
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function impersonate() {
    setBusy(true);
    const res = await apiFetch(`/api/admin/orgs/${orgId}/impersonate`, { method: 'POST' });
    if (!res.ok) {
      setBusy(false);
      toast.error(errorMessage(res));
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={impersonate} disabled={busy}>
        <LogIn className="h-3.5 w-3.5" /> {t('impersonate')}
      </Button>
      <Button
        size="sm"
        variant={suspended ? 'success' : 'outline'}
        disabled={busy}
        onClick={() => {
          if (!suspended && !confirm(t('confirmSuspend', { name: orgName }))) return;
          void run(`/api/admin/orgs/${orgId}/suspend`, 'POST', { suspended: !suspended });
        }}
      >
        {suspended ? (
          <>
            <Play className="h-3.5 w-3.5" /> {t('reactivate')}
          </>
        ) : (
          <>
            <Pause className="h-3.5 w-3.5" /> {t('suspend')}
          </>
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        aria-label={t('deleteOrg')}
        title={t('deleteOrg')}
        className="text-destructive hover:text-destructive"
        onClick={() => {
          if (confirm(t('confirmDelete', { name: orgName }))) void run(`/api/admin/orgs/${orgId}`, 'DELETE');
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// Export nommé : un composant serveur ne peut pas accéder à une propriété d'un module client.
export function PlanSelect({ orgId, plan }: { orgId: string; plan: string }) {
  const t = useTranslations('admin');
  const tp = useTranslations('plans');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState(plan);
  const [pending, startTransition] = useTransition();

  async function change(next: string) {
    const previous = value;
    setValue(next);
    const res = await apiFetch(`/api/admin/orgs/${orgId}`, { method: 'PATCH', json: { plan: next } });
    if (!res.ok) {
      setValue(previous);
      toast.error(errorMessage(res));
      return;
    }
    toast.success(t('planChanged'));
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={value}
      disabled={pending}
      aria-label={t('colPlan')}
      onChange={(e) => change(e.target.value)}
      className="rounded-full border bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
    >
      {PLANS.map((p) => (
        <option key={p} value={p}>
          {tp(p)}
        </option>
      ))}
    </select>
  );
}

