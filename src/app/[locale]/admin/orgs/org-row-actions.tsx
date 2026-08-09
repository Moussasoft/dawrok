'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pause, Play, LogIn, Trash2 } from 'lucide-react';

export function OrgRowActions({ orgId, suspended }: { orgId: string; suspended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleSuspend() {
    setBusy(true);
    await fetch(`/api/admin/orgs/${orgId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: !suspended }),
    });
    router.refresh();
    setBusy(false);
  }

  async function impersonate() {
    setBusy(true);
    const res = await fetch(`/api/admin/orgs/${orgId}/impersonate`, { method: 'POST' });
    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      setBusy(false);
    }
  }

  async function deleteOrg() {
    if (!confirm('Supprimer définitivement cette organisation et toutes ses données ?')) return;
    setBusy(true);
    await fetch(`/api/admin/orgs/${orgId}`, { method: 'DELETE' });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={impersonate} disabled={busy}>
        <LogIn className="h-3 w-3" /> Imiter
      </Button>
      <Button
        size="sm"
        variant={suspended ? 'success' : 'outline'}
        onClick={toggleSuspend}
        disabled={busy}
      >
        {suspended ? <><Play className="h-3 w-3" /> Réactiver</> : <><Pause className="h-3 w-3" /> Suspendre</>}
      </Button>
      <Button size="sm" variant="ghost" onClick={deleteOrg} disabled={busy} className="text-destructive hover:text-destructive">
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
