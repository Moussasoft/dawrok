'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, useErrorMessage } from '@/lib/api-client';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('reset');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : t('invalidLink'));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('mismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<{ loggedIn: boolean; isSuperadmin: boolean; hasOrg: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      json: { token, password },
    });
    if (!res.ok) {
      setLoading(false);
      setError(errorMessage(res));
      return;
    }
    const { loggedIn, isSuperadmin, hasOrg } = res.data;
    router.push(!loggedIn ? '/login' : isSuperadmin && !hasOrg ? '/admin' : '/dashboard');
    router.refresh();
  }

  return (
    <main className="gradient-mesh flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>{t('title')}</h1>
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!token}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t('confirm')}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={!token}
              />
            </div>
            {error && (
              <div role="alert" className="space-y-1 text-sm text-destructive">
                <p>{error}</p>
                <Link href="/forgot-password" className="text-primary hover:underline">
                  {t('requestNew')}
                </Link>
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading || !token}>
              {loading ? t('submitting') : t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
