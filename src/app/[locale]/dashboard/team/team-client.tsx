'use client';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy, Check, Link2, MailCheck, Send, Trash2, UserPlus, Users2, X } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { useApiCall } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { ROLES } from '@/lib/roles';

type Member = { id: string; name: string; email: string; role: string; createdAt: string };
type Invitation = { id: string; email: string; role: string; expiresAt: string };

export function TeamClient({
  currentUserId,
  mailEnabled,
  members,
  invitations,
}: {
  currentUserId: string;
  mailEnabled: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const t = useTranslations('team');
  const tr = useTranslations('roles');
  const locale = useLocale();
  const router = useRouter();
  const call = useApiCall();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('staff');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ url: string; email: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await call<{ inviteUrl: string; emailSent: boolean }>('/api/team/invitations', 'POST', { email, role, locale });
    setBusy(false);
    if (!res) return;
    setCreated({ url: res.inviteUrl, email, emailSent: res.emailSent });
    setEmail('');
    toast.success(t('inviteCreated'));
    refresh();
  }

  async function changeRole(member: Member, next: string) {
    if (await call(`/api/team/members/${member.id}`, 'PATCH', { role: next })) {
      toast.success(t('roleUpdated'));
      refresh();
    }
  }

  async function remove(member: Member) {
    if (!confirm(t('confirmRemove', { name: member.name }))) return;
    if (await call(`/api/team/members/${member.id}`, 'DELETE')) {
      toast.success(t('removed'));
      refresh();
    }
  }

  async function revoke(invitation: Invitation) {
    if (await call(`/api/team/invitations/${invitation.id}`, 'DELETE')) {
      toast.success(t('revoked'));
      refresh();
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users2 className="h-6 w-6 text-primary" /> {t('title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 font-semibold">{t('members')}</h2>
          <ul className="divide-y">
            {members.map((m) => {
              const self = m.id === currentUserId;
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {m.name} {self && <span className="text-xs text-muted-foreground">({t('you')})</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr">
                      {m.email}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('joined', { date: formatDate(m.createdAt, locale) })}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {self ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{tr(m.role)}</span>
                    ) : (
                      <>
                        <Select
                          value={m.role}
                          aria-label={t('role')}
                          onChange={(e) => changeRole(m, e.target.value)}
                          className="h-8 w-auto py-0 text-sm"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {tr(r)}
                            </option>
                          ))}
                        </Select>
                        <Button size="sm" variant="ghost" className="text-destructive" aria-label={t('remove')} title={t('remove')} onClick={() => remove(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 grid gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground sm:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r}>
                <dt className="font-medium text-foreground">{tr(r)}</dt>
                <dd>{tr(`${r}Desc`)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <UserPlus className="h-5 w-5 text-primary" /> {t('invite')}
          </h2>
          <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email" className="text-xs text-muted-foreground">
                {t('inviteEmail')}
              </Label>
              <Input id="inv-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role" className="text-xs text-muted-foreground">
                {t('role')}
              </Label>
              <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={busy} className="h-11">
              <Send className="h-4 w-4" /> {t('sendInvite')}
            </Button>
          </form>
          {created && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  {created.emailSent ? <MailCheck className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4 text-primary" />}
                  {created.emailSent ? t('emailSent', { email: created.email }) : mailEnabled ? t('emailFailed') : t('shareManually')}
                </p>
                <button type="button" aria-label={t('close')} onClick={() => setCreated(null)} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground">{t('inviteLink')}</div>
              <code className="block break-all rounded bg-background p-2 text-xs" dir="ltr">
                {created.url}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(created.url)}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t('copied') : t('copy')}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/?text=${encodeURIComponent(t('whatsappText', { url: created.url }))}`} target="_blank" rel="noreferrer">
                    {t('shareWhatsApp')}
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 font-semibold">{t('pending')}</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noPending')}</p>
          ) : (
            <ul className="divide-y">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate" dir="ltr">
                      {i.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tr(i.role)} · {t('expires', { date: formatDate(i.expiresAt, locale) })}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(i)}>
                    {t('revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
