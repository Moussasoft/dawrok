'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useApiCall } from '@/lib/api-client';

export function AccountCard({ account, onRefresh }: { account: { name: string; email: string }; onRefresh: () => void }) {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const call = useApiCall();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(account);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    const ok = await call('/api/account', 'PATCH', profile);
    setBusy(false);
    if (!ok) return;
    toast.success(t('profileUpdated'));
    setEditing(false);
    onRefresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) {
      toast.error(t('mismatch'));
      return;
    }
    setBusy(true);
    const ok = await call('/api/account/password', 'POST', { currentPassword: pwd.current, newPassword: pwd.next });
    setBusy(false);
    if (!ok) return;
    toast.success(t('passwordChanged'));
    setPwd({ current: '', next: '', confirm: '' });
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <UserRound className="h-5 w-5 text-primary" /> {t('title')}
          </h2>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> {tc('edit')}
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name" className="text-xs text-muted-foreground">{t('name')}</Label>
              <Input id="acc-name" value={profile.name} maxLength={80} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-email" className="text-xs text-muted-foreground">{t('email')}</Label>
              <Input id="acc-email" type="email" dir="ltr" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveProfile} disabled={busy || profile.name.trim().length < 2}>
                {busy ? tc('saving') : tc('save')}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setProfile(account); setEditing(false); }}>
                {tc('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">{t('name')}</dt>
            <dd className="font-medium">{account.name}</dd>
            <dt className="text-muted-foreground">{t('email')}</dt>
            <dd className="font-medium" dir="ltr">{account.email}</dd>
          </dl>
        )}
        <form onSubmit={changePassword} className="space-y-3 border-t pt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">{t('changePassword')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="password" autoComplete="current-password" placeholder={t('currentPassword')} aria-label={t('currentPassword')} value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
            <Input type="password" autoComplete="new-password" minLength={8} placeholder={t('newPassword')} aria-label={t('newPassword')} value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
            <Input type="password" autoComplete="new-password" minLength={8} placeholder={t('confirmPassword')} aria-label={t('confirmPassword')} value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
          </div>
          <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          <Button size="sm" type="submit" disabled={busy}>
            {t('changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
