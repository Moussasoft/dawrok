'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, useErrorMessage } from '@/lib/api-client';

export function LoginForm({ suspended }: { suspended: boolean }) {
  const router = useRouter();
  const t = useTranslations('login');
  const errorMessage = useErrorMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(suspended ? t('suspended') : null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiFetch<{ isSuperadmin: boolean; hasOrg: boolean }>('/api/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    if (!res.ok) {
      setLoading(false);
      setError(errorMessage(res));
      return;
    }
    router.push(res.data.isSuperadmin && !res.data.hasOrg ? '/admin' : '/dashboard');
    router.refresh();
  }

  return (
    <main className="gradient-mesh flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="mb-2 text-sm text-muted-foreground hover:text-foreground">
            {t('back')}
          </Link>
          <CardTitle className="text-2xl">
            <h1>{t('title')}</h1>
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')}</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  {t('forgot')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Link href="/signup" className="text-primary hover:underline">
                {t('createAccount')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
