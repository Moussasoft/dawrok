'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, useErrorMessage } from '@/lib/api-client';

export function InviteForm({ token, orgName, email, roleLabel }: { token: string; orgName: string; email: string; roleLabel: string }) {
  const t = useTranslations('invite');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiFetch('/api/auth/accept-invitation', { method: 'POST', json: { token, name, password } });
    if (!res.ok) {
      setLoading(false);
      setError(errorMessage(res));
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>{t('title', { org: orgName })}</h1>
        </CardTitle>
        <CardDescription>{t('description', { role: roleLabel })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-mail">{t('email')}</Label>
            <Input id="inv-mail" value={email} dir="ltr" disabled readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">{t('name')}</Label>
            <Input id="inv-name" value={name} autoComplete="name" maxLength={80} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-pass">{t('password')}</Label>
            <Input
              id="inv-pass"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? t('submitting') : t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
