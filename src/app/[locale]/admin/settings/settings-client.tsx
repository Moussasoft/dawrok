'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { User, Lock, CreditCard, Shield, Bell, Pencil, Check, X, Trash2, Plus, Eye, EyeOff, Info } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type PlanConfig = {
  plan: string;
  price: number;
  maxBranches: number;
  maxEmployees: number;
  maxServices: number;
  allowBooking: boolean;
  allowAnalytics: boolean;
  allowCustomBrand: boolean;
};
type Superadmin = { id: string; name: string; email: string; createdAt: string };
type Notifications = { newOrgSignup: boolean; orgSuspended: boolean; orgOverLimit: boolean; dailyReport: boolean; notifEmail: string };
type CurrentUser = { id: string; name: string; email: string };

const TABS = [
  { id: 'profile', key: 'tabProfile', icon: User },
  { id: 'security', key: 'tabSecurity', icon: Lock },
  { id: 'plans', key: 'tabPlans', icon: CreditCard },
  { id: 'admins', key: 'tabAdmins', icon: Shield },
  { id: 'notifs', key: 'tabNotifications', icon: Bell },
] as const;
type TabId = (typeof TABS)[number]['id'];

const SUPERADMIN_MIN_PASSWORD = 12;

function useApi() {
  const errorMessage = useErrorMessage();
  return async function call<T = Record<string, unknown>>(url: string, method: string, json?: unknown): Promise<T | null> {
    const res = await apiFetch<T>(url, { method, json });
    if (!res.ok) {
      toast.error(errorMessage(res));
      return null;
    }
    return res.data;
  };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function PasswordInput({ id, value, onChange, show, placeholder }: { id: string; value: string; onChange: (v: string) => void; show: boolean; placeholder?: string }) {
  return (
    <Input
      id={id}
      type={show ? 'text' : 'password'}
      value={value}
      placeholder={placeholder}
      autoComplete="new-password"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ─── Profil ───────────────────────────────────────────────────────────────────

function ProfileSection({ user, onRefresh }: { user: CurrentUser; onRefresh: () => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const call = useApi();
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await call('/api/admin/settings/profile', 'PATCH', form);
    setSaving(false);
    if (!ok) return;
    toast.success(t('profileUpdated'));
    setEditing(false);
    onRefresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('tabProfile')}</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> {tc('edit')}
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sa-name" className="text-muted-foreground">
                {t('name')}
              </Label>
              <Input id="sa-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sa-email" className="text-muted-foreground">
                {t('email')}
              </Label>
              <Input id="sa-email" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? tc('saving') : tc('save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setForm({ name: user.name, email: user.email });
                }}
              >
                {tc('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-b py-1.5">
              <span className="text-muted-foreground">{t('name')}</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">{t('email')}</span>
              <span className="font-medium" dir="ltr">
                {user.email}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sécurité ─────────────────────────────────────────────────────────────────

function SecuritySection() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const call = useApi();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (form.newPassword !== form.confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setSaving(true);
    const ok = await call('/api/admin/settings/password', 'POST', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    setSaving(false);
    if (!ok) return;
    toast.success(t('passwordChanged'));
    setForm({ currentPassword: '', newPassword: '', confirm: '' });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('changePassword')}</h2>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {show ? t('hidePassword') : t('showPassword')}
          </button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pw-current" className="text-muted-foreground">
              {t('currentPassword')}
            </Label>
            <PasswordInput id="pw-current" show={show} value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pw-new" className="text-muted-foreground">
              {t('newPassword')}
            </Label>
            <PasswordInput
              id="pw-new"
              show={show}
              value={form.newPassword}
              placeholder={t('passwordMin', { count: 8 })}
              onChange={(v) => setForm({ ...form, newPassword: v })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pw-confirm" className="text-muted-foreground">
              {t('confirmPassword')}
            </Label>
            <PasswordInput id="pw-confirm" show={show} value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="sm" onClick={save} disabled={saving || !form.currentPassword || form.newPassword.length < 8}>
            {saving ? tc('saving') : t('submitPassword')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Offres & limites ─────────────────────────────────────────────────────────

function PlansSection({ initialConfigs, currency }: { initialConfigs: PlanConfig[]; currency: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const tp = useTranslations('plans');
  const call = useApi();
  const [configs, setConfigs] = useState(initialConfigs);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [form, setForm] = useState<PlanConfig | null>(null);
  const [saving, setSaving] = useState(false);

  async function savePlan() {
    if (!form) return;
    setSaving(true);
    const ok = await call('/api/admin/settings/plans', 'PATCH', form);
    setSaving(false);
    if (!ok) return;
    setConfigs((prev) => prev.map((c) => (c.plan === form.plan ? form : c)));
    setEditingPlan(null);
    toast.success(t('planSaved'));
  }

  const numberFields = [
    ['price', t('priceMonthly', { currency }), 0],
    ['maxBranches', t('maxBranches'), 1],
    ['maxEmployees', t('maxEmployees'), 1],
    ['maxServices', t('maxServices'), 1],
  ] as const;
  const featureFields = [
    ['allowBooking', t('featureBooking')],
    ['allowAnalytics', t('featureAnalytics')],
    ['allowCustomBrand', t('featureBranding')],
  ] as const;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <h2 className="text-base font-semibold">{t('tabPlans')}</h2>
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.plan} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{tp.has(cfg.plan) ? tp(cfg.plan) : cfg.plan}</span>
                {editingPlan !== cfg.plan && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingPlan(cfg.plan);
                      setForm({ ...cfg });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> {tc('edit')}
                  </Button>
                )}
              </div>

              {editingPlan === cfg.plan && form ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {numberFields.map(([key, label, min]) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={`${cfg.plan}-${key}`} className="text-xs text-muted-foreground">
                          {label}
                        </Label>
                        <Input
                          id={`${cfg.plan}-${key}`}
                          type="number"
                          min={min}
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {featureFields.map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Toggle checked={form[key]} label={label} onChange={(v) => setForm({ ...form, [key]: v })} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={savePlan} disabled={saving}>
                      {saving ? tc('saving') : tc('save')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPlan(null)}>
                      {tc('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">{t('price')}</span>
                  <span className="font-medium">{cfg.price === 0 ? t('free') : t('perMonth', { price: cfg.price, currency })}</span>
                  <span className="text-muted-foreground">{t('maxBranches')}</span>
                  <span className="font-medium tabular-nums">{cfg.maxBranches}</span>
                  <span className="text-muted-foreground">{t('maxEmployees')}</span>
                  <span className="font-medium tabular-nums">{cfg.maxEmployees}</span>
                  <span className="text-muted-foreground">{t('maxServices')}</span>
                  <span className="font-medium tabular-nums">{cfg.maxServices}</span>
                  {featureFields.map(([key, label]) => (
                    <FeatureRow key={key} label={label} enabled={cfg[key]} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{enabled ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground/50" />}</span>
    </>
  );
}

// ─── Superadmins ──────────────────────────────────────────────────────────────

function SuperadminsSection({ initialList, currentUserId }: { initialList: Superadmin[]; currentUserId: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const call = useApi();
  const [list, setList] = useState(initialList);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function invite() {
    setSaving(true);
    const res = await call<{ user: Superadmin }>('/api/admin/settings/superadmins', 'POST', form);
    setSaving(false);
    if (!res) return;
    setList((prev) => [...prev, res.user]);
    setForm({ name: '', email: '', password: '' });
    setShowForm(false);
    toast.success(t('invited'));
  }

  async function revoke(sa: Superadmin) {
    if (!confirm(t('confirmRevoke', { name: sa.name }))) return;
    setRevoking(sa.id);
    const ok = await call(`/api/admin/settings/superadmins/${sa.id}`, 'DELETE');
    setRevoking(null);
    if (!ok) return;
    setList((prev) => prev.filter((s) => s.id !== sa.id));
    toast.success(t('revoked'));
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('tabAdmins')}</h2>
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-3.5 w-3.5" /> {t('invite')}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{t('newAdmin')}</p>
            <Input placeholder={t('name')} aria-label={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input
              type="email"
              dir="ltr"
              placeholder={t('email')}
              aria-label={t('email')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <Input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('passwordMin', { count: SUPERADMIN_MIN_PASSWORD })}
                aria-label={t('newPassword')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                aria-label={showPwd ? t('hidePassword') : t('showPassword')}
                className="text-muted-foreground"
                onClick={() => setShowPwd((s) => !s)}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={invite}
                disabled={saving || !form.name || !form.email || form.password.length < SUPERADMIN_MIN_PASSWORD}
              >
                {saving ? t('creating') : t('createAccount')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                {tc('cancel')}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {list.map((sa) => (
            <div key={sa.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{sa.name}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {sa.email}
                </p>
              </div>
              {sa.id === currentUserId ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t('you')}</span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('revoke')}
                  title={t('revoke')}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => revoke(sa)}
                  disabled={revoking === sa.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsSection({ initialConfig }: { initialConfig: Notifications }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const call = useApi();
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);

  async function save(key: keyof Notifications, value: boolean | string) {
    setSaving(true);
    const ok = await call('/api/admin/settings/notifications', 'PATCH', { [key]: value });
    setSaving(false);
    if (!ok) return;
    setConfig((prev) => ({ ...prev, [key]: value }));
    toast.success(tc('saved'));
  }

  const fields = [
    { key: 'newOrgSignup', label: t('notifNewOrg'), desc: t('notifNewOrgDesc') },
    { key: 'orgSuspended', label: t('notifSuspended'), desc: t('notifSuspendedDesc') },
    { key: 'orgOverLimit', label: t('notifOverLimit'), desc: t('notifOverLimitDesc') },
    { key: 'dailyReport', label: t('notifDaily'), desc: t('notifDailyDesc') },
  ] as const;

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('notifTitle')}</h2>
          {saving && <span className="text-xs text-muted-foreground">{tc('saving')}</span>}
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" /> {t('notifPending')}
        </p>
        <div className="space-y-1">
          <Label htmlFor="notif-email" className="text-muted-foreground">
            {t('notifEmail')}
          </Label>
          <div className="flex gap-2">
            <Input
              id="notif-email"
              type="email"
              dir="ltr"
              placeholder="admin@example.com"
              value={config.notifEmail}
              onChange={(e) => setConfig((prev) => ({ ...prev, notifEmail: e.target.value }))}
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" aria-label={tc('save')} onClick={() => save('notifEmail', config.notifEmail)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {fields.map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Toggle checked={config[key]} label={label} onChange={(v) => save(key, v)} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsClient({
  currentUser,
  currency,
  planConfigs,
  superadmins,
  notifications,
}: {
  currentUser: CurrentUser;
  currency: string;
  planConfigs: PlanConfig[];
  superadmins: Superadmin[];
  notifications: Notifications;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t('settings')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settingsSubtitle')}</p>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(({ id, key, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={cn(
              '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileSection user={currentUser} onRefresh={() => router.refresh()} />}
      {activeTab === 'security' && <SecuritySection />}
      {activeTab === 'plans' && <PlansSection initialConfigs={planConfigs} currency={currency} />}
      {activeTab === 'admins' && <SuperadminsSection initialList={superadmins} currentUserId={currentUser.id} />}
      {activeTab === 'notifs' && <NotificationsSection initialConfig={notifications} />}
    </div>
  );
}
