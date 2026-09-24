'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, useErrorMessage } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgot');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiFetch('/api/auth/forgot-password', { method: 'POST', json: { email, locale } });
    setLoading(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    setSent(true);
  }

  return (
    <main className="gradient-mesh flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/login" className="mb-2 text-sm text-muted-foreground hover:text-foreground">
            {t('back')}
          </Link>
          <CardTitle className="text-2xl">
            <h1>{t('title')}</h1>
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div role="status" className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm">
              <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
              <p>{t('sent')}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
          )}
        </CardContent>
      </Card>
    </main>
  );
}
