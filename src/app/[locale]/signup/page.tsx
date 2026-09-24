'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { SECTORS, SECTOR_I18N_KEY } from '@/lib/sectors';
import { AcceptTerms } from '@/components/accept-terms';

export default function SignupPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('signup');
  const ts = useTranslations('sectors');
  const errorMessage = useErrorMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ orgName: '', sector: 'hairdresser', name: '', email: '', password: '', acceptTerms: false });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // La langue d'inscription sert à nommer les prestations de départ.
    const res = await apiFetch('/api/auth/signup', { method: 'POST', json: { ...form, locale } });
    if (!res.ok) {
      setLoading(false);
      setError(errorMessage(res));
      return;
    }
    router.push('/dashboard');
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
              <Label htmlFor="orgName">{t('orgName')}</Label>
              <Input
                id="orgName"
                placeholder={t('orgNamePlaceholder')}
                value={form.orgName}
                maxLength={100}
                autoComplete="organization"
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector">{t('sector')}</Label>
              <Select id="sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {ts(SECTOR_I18N_KEY[s])}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('yourName')}</Label>
              <Input
                id="name"
                value={form.name}
                maxLength={80}
                autoComplete="name"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
            </div>
            <AcceptTerms checked={form.acceptTerms} onChange={(acceptTerms) => setForm({ ...form, acceptTerms })} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('alreadyAccount')}{' '}
              <Link href="/login" className="text-primary hover:underline">
                {t('loginLink')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
