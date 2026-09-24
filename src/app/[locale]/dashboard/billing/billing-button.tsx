'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiCall } from '@/lib/api-client';

/** Ouvre Stripe Checkout (souscription) ou le portail client (gestion). */
export function BillingButton({
  action,
  plan,
  label,
  variant = 'default',
}: {
  action: 'checkout' | 'portal';
  plan?: string;
  label: string;
  variant?: 'default' | 'outline';
}) {
  const locale = useLocale();
  const call = useApiCall();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const res = await call<{ url: string }>(`/api/billing/${action}`, 'POST', { plan, locale });
    if (res?.url) window.location.href = res.url;
    else setBusy(false);
  }

  return (
    <Button onClick={go} disabled={busy} variant={variant} className="w-full">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}
