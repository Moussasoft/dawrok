'use client';
import { useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { AccountCard } from './account-card';

export function AccountView({ account }: { account: { name: string; email: string } }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return <AccountCard account={account} onRefresh={() => startTransition(() => router.refresh())} />;
}
