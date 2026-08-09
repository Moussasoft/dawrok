'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SECTOR_KEYS = ['hairdresser', 'doctor', 'vehicle_inspection', 'bank', 'restaurant', 'other'] as const;

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations();
  const sectors = SECTOR_KEYS.map((key) => ({
    value: key,
    label: t(`sectors.${key}`),
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    orgName: '',
    sector: 'hairdresser',
    name: '',
    email: '',
    password: '',
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || t('signup.error'));
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-2">{t('signup.back')}</Link>
          <CardTitle className="text-2xl">{t('signup.title')}</CardTitle>
          <CardDescription>{t('signup.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="orgName">{t('signup.orgName')}</Label>
              <Input id="orgName" placeholder={t('signup.orgNamePlaceholder')} value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector">{t('signup.sector')}</Label>
              <select
                id="sector"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base shadow-sm"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              >
                {sectors.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('signup.yourName')}</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('signup.email')}</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('signup.password')}</Label>
              <Input id="password" type="password" minLength={8} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <p className="text-xs text-muted-foreground">{t('signup.passwordHint')}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t('signup.submitting') : t('signup.submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('signup.alreadyAccount')} <Link href="/login" className="text-primary hover:underline">{t('signup.loginLink')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
