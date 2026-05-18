'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User, Lock, CreditCard, Shield, Bell,
  Pencil, Check, X, Trash2, Plus, Eye, EyeOff,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanConfig = {
  id: string; plan: string; price: number;
  maxBranches: number; maxEmployees: number; maxServices: number;
  allowBooking: boolean; allowAnalytics: boolean; allowCustomBrand: boolean;
};
type Superadmin = { id: string; name: string; email: string; createdAt: string };
type Notifications = {
  newOrgSignup: boolean; orgSuspended: boolean; orgOverLimit: boolean;
  dailyReport: boolean; notifEmail: string;
};
type CurrentUser = { id: string; name: string; email: string };

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile',   label: 'Profil',          icon: User },
  { id: 'security',  label: 'Sécurité',        icon: Lock },
  { id: 'plans',     label: 'Plans & Limites',  icon: CreditCard },
  { id: 'admins',    label: 'Superadmins',      icon: Shield },
  { id: 'notifs',    label: 'Notifications',    icon: Bell },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', business: 'Business',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection({ user, onRefresh }: { user: CurrentUser; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    const res = await fetch('/api/admin/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur'); return;
    }
    setSuccess('Profil mis à jour'); setEditing(false); onRefresh();
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Profil</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Nom</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Sauvegarde…' : 'Enregistrer'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm({ name: user.name, email: user.email }); setError(''); }}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {success && <p className="text-emerald-600 text-xs">{success}</p>}
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Nom</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function save() {
    setError(''); setSuccess('');
    if (form.newPassword !== form.confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur'); return;
    }
    setSuccess('Mot de passe modifié avec succès');
    setForm({ currentPassword: '', newPassword: '', confirm: '' });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h2 className="font-semibold text-base">Changer le mot de passe</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Mot de passe actuel</label>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShow(s => !s)}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nouveau mot de passe</label>
            <Input
              type={show ? 'text' : 'password'}
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              placeholder="Min. 8 caractères"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Confirmer le nouveau mot de passe</label>
            <Input
              type={show ? 'text' : 'password'}
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </div>
          {error   && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <Button size="sm" onClick={save} disabled={saving || !form.currentPassword || !form.newPassword}>
            {saving ? 'Sauvegarde…' : 'Modifier le mot de passe'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Plans Section ────────────────────────────────────────────────────────────

function PlansSection({ initialConfigs }: { initialConfigs: PlanConfig[] }) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PlanConfig>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startEdit(cfg: PlanConfig) {
    setEditingPlan(cfg.plan);
    setForm({ ...cfg });
    setError('');
  }

  async function savePlan() {
    setSaving(true); setError('');
    const res = await fetch('/api/admin/settings/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur'); return; }
    setConfigs(prev => prev.map(c => c.plan === form.plan ? { ...c, ...form } as PlanConfig : c));
    setEditingPlan(null);
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h2 className="font-semibold text-base">Plans & Limites</h2>
        <div className="space-y-3">
          {configs.map(cfg => (
            <div key={cfg.plan} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{PLAN_LABELS[cfg.plan] ?? cfg.plan}</span>
                {editingPlan !== cfg.plan && (
                  <Button variant="outline" size="sm" onClick={() => startEdit(cfg)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                  </Button>
                )}
              </div>

              {editingPlan === cfg.plan ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Prix mensuel (€)</label>
                      <Input type="number" min="0" value={form.price ?? 0}
                        onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Max branches</label>
                      <Input type="number" min="1" value={form.maxBranches ?? 1}
                        onChange={e => setForm(f => ({ ...f, maxBranches: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Max employés</label>
                      <Input type="number" min="1" value={form.maxEmployees ?? 1}
                        onChange={e => setForm(f => ({ ...f, maxEmployees: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Max services</label>
                      <Input type="number" min="1" value={form.maxServices ?? 1}
                        onChange={e => setForm(f => ({ ...f, maxServices: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {([
                      ['allowBooking',    'Réservation en ligne'],
                      ['allowAnalytics',  'Analytics avancées'],
                      ['allowCustomBrand','Personnalisation marque'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Toggle
                          checked={!!form[key]}
                          onChange={v => setForm(f => ({ ...f, [key]: v }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={savePlan} disabled={saving}>{saving ? 'Sauvegarde…' : 'Enregistrer'}</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPlan(null)}>Annuler</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Prix</span>
                  <span className="font-medium">{cfg.price === 0 ? 'Gratuit' : `${cfg.price} €/mois`}</span>
                  <span className="text-muted-foreground">Branches max</span>
                  <span className="font-medium">{cfg.maxBranches}</span>
                  <span className="text-muted-foreground">Employés max</span>
                  <span className="font-medium">{cfg.maxEmployees}</span>
                  <span className="text-muted-foreground">Services max</span>
                  <span className="font-medium">{cfg.maxServices}</span>
                  <span className="text-muted-foreground">Réservation</span>
                  <span>{cfg.allowBooking ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground/50" />}</span>
                  <span className="text-muted-foreground">Analytics</span>
                  <span>{cfg.allowAnalytics ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground/50" />}</span>
                  <span className="text-muted-foreground">Personnalisation</span>
                  <span>{cfg.allowCustomBrand ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground/50" />}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Superadmins Section ──────────────────────────────────────────────────────

function SuperadminsSection({ initialList, currentUserId }: { initialList: Superadmin[]; currentUserId: string }) {
  const [list, setList] = useState(initialList);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  async function invite() {
    setSaving(true); setError('');
    const res = await fetch('/api/admin/settings/superadmins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur'); return; }
    const { user } = await res.json();
    setList(prev => [...prev, user]);
    setForm({ name: '', email: '', password: '' });
    setShowForm(false);
  }

  async function revoke(id: string) {
    setRevoking(id);
    const res = await fetch(`/api/admin/settings/superadmins/${id}`, { method: 'DELETE' });
    setRevoking(null);
    if (!res.ok) return;
    setList(prev => prev.filter(s => s.id !== id));
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Superadmins</h2>
          <Button size="sm" variant="outline" onClick={() => setShowForm(s => !s)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Inviter
          </Button>
        </div>

        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Nouveau superadmin</p>
            <Input placeholder="Nom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                placeholder="Mot de passe (min 8 caract.)"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPwd(s => !s)}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={invite} disabled={saving || !form.name || !form.email || !form.password}>
                {saving ? 'Création…' : 'Créer le compte'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setError(''); }}>Annuler</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {list.map(sa => (
            <div key={sa.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{sa.name}</p>
                <p className="text-xs text-muted-foreground">{sa.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {sa.id === currentUserId && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">vous</span>
                )}
                {sa.id !== currentUserId && (
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => revoke(sa.id)}
                    disabled={revoking === sa.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Notifications Section ────────────────────────────────────────────────────

function NotificationsSection({ initialConfig }: { initialConfig: Notifications }) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function saveToggle(key: keyof Notifications, value: boolean | string) {
    setSaving(true); setSuccess(''); setError('');
    const res = await fetch('/api/admin/settings/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur'); return; }
    setConfig(prev => ({ ...prev, [key]: value }));
    setSuccess('Sauvegardé');
    setTimeout(() => setSuccess(''), 2000);
  }

  const boolFields: { key: keyof Notifications; label: string; desc: string }[] = [
    { key: 'newOrgSignup', label: 'Nouvelle organisation',  desc: 'Alerte quand une organisation s\'inscrit' },
    { key: 'orgSuspended', label: 'Organisation suspendue', desc: 'Alerte quand une org est suspendue ou réactivée' },
    { key: 'orgOverLimit', label: 'Dépassement de limite',  desc: 'Alerte quand une org dépasse les limites de son plan' },
    { key: 'dailyReport',  label: 'Rapport quotidien',      desc: 'Récapitulatif quotidien des activités' },
  ];

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Notifications par email</h2>
          {saving && <span className="text-xs text-muted-foreground">Sauvegarde…</span>}
          {success && <span className="text-xs text-emerald-600">{success}</span>}
          {error   && <span className="text-xs text-destructive">{error}</span>}
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Email de réception</label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="admin@exemple.com"
              value={config.notifEmail}
              onChange={e => setConfig(prev => ({ ...prev, notifEmail: e.target.value }))}
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={() => saveToggle('notifEmail', config.notifEmail)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {boolFields.map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Toggle
                checked={!!config[key]}
                onChange={v => saveToggle(key, v)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminSettingsClient({
  currentUser, planConfigs, superadmins, notifications,
}: {
  currentUser: CurrentUser;
  planConfigs: PlanConfig[];
  superadmins: Superadmin[];
  notifications: Notifications;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Réglages</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez votre compte et la configuration de la plateforme</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile'  && <ProfileSection user={currentUser} onRefresh={() => router.refresh()} />}
      {activeTab === 'security' && <SecuritySection />}
      {activeTab === 'plans'    && <PlansSection initialConfigs={planConfigs} />}
      {activeTab === 'admins'   && <SuperadminsSection initialList={superadmins} currentUserId={currentUser.id} />}
      {activeTab === 'notifs'   && <NotificationsSection initialConfig={notifications} />}
    </div>
  );
}
