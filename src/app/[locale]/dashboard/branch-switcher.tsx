'use client';
import { useTransition } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/routing';
import { apiFetch, useErrorMessage } from '@/lib/api-client';

type Props = { label: string; activeId: string; branches: { id: string; name: string }[] };

export function BranchSwitcher({ label, activeId, branches }: Props) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();

  async function select(branchId: string) {
    const res = await apiFetch('/api/dashboard/branch', { method: 'POST', json: { branchId } });
    if (!res.ok) {
      toast.error(errorMessage(res));
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <label className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg border bg-background px-2 text-sm">
      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => select(e.target.value)}
        className="min-w-0 max-w-[9rem] cursor-pointer truncate bg-transparent font-medium focus:outline-none sm:max-w-[14rem]"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
