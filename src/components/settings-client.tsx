'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Service = { id: string; name: string; avgDurationMin: number; color: string; active: boolean };
type Employee = { id: string; name: string; active: boolean };
type Branch = { id: string; name: string; address: string | null; services: Service[]; employees: Employee[] };
type Org = { id: string; name: string; slug: string; sector: string; plan: string; brandColor: string };

const SECTORS = [
  { value: 'hairdresser', label: 'Coiffure' },
  { value: 'doctor', label: 'Médecine' },
  { value: 'vehicle_inspection', label: 'Contrôle technique' },
  { value: 'bank', label: 'Banque' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'other', label: 'Autre' },
];

function sectorLabel(value: string) {
  return SECTORS.find((s) => s.value === value)?.label ?? value;
}

// ─── Organisation ─────────────────────────────────────────────────────────────
function OrgCard({ org, onRefresh }: { org: Org; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: org.name, sector: org.sector, brandColor: org.brandColor });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/settings/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur lors de la sauvegarde');
      return;
    }
    setEditing(false);
    onRefresh();
  }

  function cancel() {
    setForm({ name: org.name, sector: org.sector, brandColor: org.brandColor });
    setError('');
    setEditing(false);
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Organisation</h3>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nom</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Secteur</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.sector}
                onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
              >
                {SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Couleur de marque</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
                  className="h-9 w-14 rounded border cursor-pointer p-1"
                />
                <span className="text-xs font-mono text-muted-foreground">{form.brandColor}</span>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? 'Sauvegarde…' : 'Enregistrer'}
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">Nom</dt>
            <dd className="font-medium">{org.name}</dd>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono text-xs">{org.slug}</dd>
            <dt className="text-muted-foreground">Secteur</dt>
            <dd>{sectorLabel(org.sector)}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="capitalize">{org.plan}</dd>
            <dt className="text-muted-foreground">Couleur</dt>
            <dd>
              <span
                className="inline-flex items-center gap-2"
              >
                <span
                  className="inline-block w-4 h-4 rounded-full border"
                  style={{ backgroundColor: org.brandColor }}
                />
                <span className="font-mono text-xs">{org.brandColor}</span>
              </span>
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Service row ──────────────────────────────────────────────────────────────
function ServiceRow({
  service,
  onUpdated,
  onDeleted,
}: {
  service: Service;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: service.name, avgDurationMin: service.avgDurationMin });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/settings/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, avgDurationMin: Number(form.avgDurationMin) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur');
      return;
    }
    setEditing(false);
    onUpdated();
  }

  async function remove() {
    if (!confirm(`Supprimer le service "${service.name}" ?`)) return;
    setBusy(true);
    await fetch(`/api/settings/services/${service.id}`, { method: 'DELETE' });
    onDeleted();
  }

  async function toggleActive() {
    setBusy(true);
    await fetch(`/api/settings/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !service.active }),
    });
    setBusy(false);
    onUpdated();
  }

  if (editing) {
    return (
      <li className="rounded bg-muted px-3 py-2 space-y-2">
        <div className="flex gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nom du service"
          />
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="w-20 h-8 text-sm"
              value={form.avgDurationMin}
              min={1}
              max={480}
              onChange={(e) => setForm((f) => ({ ...f, avgDurationMin: Number(e.target.value) }))}
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy} className="h-7 text-xs">
            Enregistrer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditing(false); setForm({ name: service.name, avgDurationMin: service.avgDurationMin }); setError(''); }}
            disabled={busy}
            className="h-7 text-xs"
          >
            Annuler
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between text-sm rounded bg-muted px-3 py-2">
      <span className={service.active ? '' : 'line-through text-muted-foreground'}>{service.name}</span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">~{service.avgDurationMin} min</span>
        <button
          onClick={() => setEditing(true)}
          disabled={busy}
          className="text-xs text-primary hover:underline"
        >
          Modifier
        </button>
        <button
          onClick={toggleActive}
          disabled={busy}
          className="text-xs text-muted-foreground hover:underline"
        >
          {service.active ? 'Désactiver' : 'Activer'}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="text-xs text-destructive hover:underline"
        >
          Supprimer
        </button>
      </div>
    </li>
  );
}

// ─── Add service form ─────────────────────────────────────────────────────────
function AddServiceForm({ branchId, onAdded }: { branchId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', avgDurationMin: 20 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.name.trim()) { setError('Le nom est requis'); return; }
    setBusy(true);
    setError('');
    const res = await fetch(`/api/settings/branches/${branchId}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), avgDurationMin: Number(form.avgDurationMin) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur');
      return;
    }
    setForm({ name: '', avgDurationMin: 20 });
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-primary hover:underline"
      >
        + Ajouter un service
      </button>
    );
  }

  return (
    <div className="mt-2 rounded border bg-background p-3 space-y-2">
      <div className="flex gap-2">
        <Input
          className="flex-1 h-8 text-sm"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nom du service"
          autoFocus
        />
        <div className="flex items-center gap-1">
          <Input
            type="number"
            className="w-20 h-8 text-sm"
            value={form.avgDurationMin}
            min={1}
            max={480}
            onChange={(e) => setForm((f) => ({ ...f, avgDurationMin: Number(e.target.value) }))}
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={busy} className="h-7 text-xs">
          {busy ? '…' : 'Ajouter'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setOpen(false); setError(''); }}
          disabled={busy}
          className="h-7 text-xs"
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ─── Employee row ─────────────────────────────────────────────────────────────
function EmployeeRow({
  employee,
  onUpdated,
  onDeleted,
}: {
  employee: Employee;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/settings/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur');
      return;
    }
    setEditing(false);
    onUpdated();
  }

  async function toggleActive() {
    setBusy(true);
    await fetch(`/api/settings/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !employee.active }),
    });
    setBusy(false);
    onUpdated();
  }

  async function remove() {
    if (!confirm(`Supprimer l'employé "${employee.name}" ?`)) return;
    setBusy(true);
    await fetch(`/api/settings/employees/${employee.id}`, { method: 'DELETE' });
    onDeleted();
  }

  if (editing) {
    return (
      <li className="rounded bg-muted px-3 py-2 space-y-2">
        <Input
          className="h-8 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'employé"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy} className="h-7 text-xs">
            Enregistrer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditing(false); setName(employee.name); setError(''); }}
            disabled={busy}
            className="h-7 text-xs"
          >
            Annuler
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between text-sm rounded bg-muted px-3 py-2">
      <span>{employee.name}</span>
      <div className="flex items-center gap-3">
        <span
          className={
            employee.active ? 'text-xs text-green-600 dark:text-green-400' : 'text-xs text-muted-foreground'
          }
        >
          {employee.active ? 'Actif' : 'Inactif'}
        </span>
        <button onClick={() => setEditing(true)} disabled={busy} className="text-xs text-primary hover:underline">
          Modifier
        </button>
        <button onClick={toggleActive} disabled={busy} className="text-xs text-muted-foreground hover:underline">
          {employee.active ? 'Désactiver' : 'Activer'}
        </button>
        <button onClick={remove} disabled={busy} className="text-xs text-destructive hover:underline">
          Supprimer
        </button>
      </div>
    </li>
  );
}

// ─── Add employee form ────────────────────────────────────────────────────────
function AddEmployeeForm({ branchId, onAdded }: { branchId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) { setError('Le nom est requis'); return; }
    setBusy(true);
    setError('');
    const res = await fetch(`/api/settings/branches/${branchId}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur');
      return;
    }
    setName('');
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs text-primary hover:underline">
        + Ajouter un employé
      </button>
    );
  }

  return (
    <div className="mt-2 rounded border bg-background p-3 space-y-2">
      <Input
        className="h-8 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom de l'employé"
        autoFocus
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={busy} className="h-7 text-xs">
          {busy ? '…' : 'Ajouter'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setOpen(false); setError(''); }}
          disabled={busy}
          className="h-7 text-xs"
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ─── Branch card ──────────────────────────────────────────────────────────────
function BranchCard({ branch, onRefresh }: { branch: Branch; onRefresh: () => void }) {
  const [editingInfo, setEditingInfo] = useState(false);
  const [form, setForm] = useState({ name: branch.name, address: branch.address ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function saveInfo() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/settings/branches/${branch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, address: form.address || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Erreur');
      return;
    }
    setEditingInfo(false);
    onRefresh();
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-6">
        {/* Branch header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold">📍 {branch.name}</h3>
            {branch.address && (
              <p className="text-xs text-muted-foreground mt-0.5">{branch.address}</p>
            )}
          </div>
          {!editingInfo && (
            <Button size="sm" variant="outline" onClick={() => setEditingInfo(true)}>
              Modifier
            </Button>
          )}
        </div>

        {editingInfo && (
          <div className="mb-4 space-y-2 rounded border bg-muted/50 p-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nom de la succursale</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Adresse</label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Adresse (optionnel)"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={saveInfo} disabled={busy}>
                {busy ? 'Sauvegarde…' : 'Enregistrer'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingInfo(false); setForm({ name: branch.name, address: branch.address ?? '' }); setError(''); }}
                disabled={busy}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Services */}
        <div className="mb-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">
            Services ({branch.services.length})
          </div>
          <ul className="space-y-1.5">
            {branch.services.map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                onUpdated={onRefresh}
                onDeleted={onRefresh}
              />
            ))}
          </ul>
          <AddServiceForm branchId={branch.id} onAdded={onRefresh} />
        </div>

        {/* Employees */}
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-2">
            Employés ({branch.employees.length})
          </div>
          <ul className="space-y-1.5">
            {branch.employees.map((e) => (
              <EmployeeRow
                key={e.id}
                employee={e}
                onUpdated={onRefresh}
                onDeleted={onRefresh}
              />
            ))}
          </ul>
          <AddEmployeeForm branchId={branch.id} onAdded={onRefresh} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function SettingsClient({ org, branches }: { org: Org; branches: Branch[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="container py-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Réglages</h1>
      <p className="text-muted-foreground mb-6">Configurez votre commerce, vos services et vos employés.</p>

      <OrgCard org={org} onRefresh={refresh} />

      {branches.map((b) => (
        <BranchCard key={b.id} branch={b} onRefresh={refresh} />
      ))}
    </div>
  );
}
