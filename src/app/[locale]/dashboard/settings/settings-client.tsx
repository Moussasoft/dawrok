'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, Clock, CalendarDays, MapPin, Plus, Lock, Pencil, Trash2, Power } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { useApiCall } from '@/lib/api-client';
import { SECTORS, SECTOR_I18N_KEY } from '@/lib/sectors';
import { WEEKDAYS, type Weekday } from '@/lib/time';
import { weekdayName } from '@/lib/format';
import type { OpenHours } from '@/lib/opening-hours';
import { cn } from '@/lib/utils';
import { LogoUploader } from './logo-uploader';

type Service = { id: string; name: string; avgDurationMin: number; active: boolean };
type Employee = { id: string; name: string; active: boolean };
type Branch = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  allowBooking: boolean;
  bookingSlotMin: number;
  openHours: OpenHours | null;
  services: Service[];
  employees: Employee[];
};
type Org = { id: string; name: string; slug: string; sector: string; plan: string; brandColor: string; logoUrl: string | null };
type Limits = {
  plan: string;
  maxBranches: number;
  maxEmployees: number;
  maxServices: number;
  allowBooking: boolean;
  allowAnalytics: boolean;
  allowCustomBrand: boolean;
};
type Usage = { branches: number; employees: number; services: number };


export function SettingsClient({
  canEditOrg,
  org,
  limits,
  usage,
  branches,
}: {
  /** Seul le propriétaire modifie l'organisation (nom, secteur, marque). */
  canEditOrg: boolean;
  org: Org;
  limits: Limits;
  usage: Usage;
  branches: Branch[];
}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="container max-w-3xl py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-6 text-muted-foreground">{t('subtitle')}</p>

      <OrgCard org={org} limits={limits} usage={usage} canEdit={canEditOrg} onRefresh={refresh} />

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-semibold">
        <MapPin className="h-5 w-5 text-primary" /> {t('branches')}
      </h2>
      {branches.map((b) => (
        <BranchCard key={b.id} branch={b} limits={limits} usage={usage} onRefresh={refresh} />
      ))}
      <AddBranchForm disabled={usage.branches >= limits.maxBranches} max={limits.maxBranches} onAdded={refresh} />
    </div>
  );
}

// ─── Organisation ─────────────────────────────────────────────────────────────

function OrgCard({
  org,
  limits,
  usage,
  canEdit,
  onRefresh,
}: {
  org: Org;
  limits: Limits;
  usage: Usage;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const ts = useTranslations('sectors');
  const tp = useTranslations('plans');
  const call = useApiCall();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: org.name, sector: org.sector, brandColor: org.brandColor });
  const [saving, setSaving] = useState(false);

  const sectorLabel = (s: string) => ts((SECTOR_I18N_KEY as Record<string, string>)[s] ?? 'other');

  async function save() {
    setSaving(true);
    const payload = limits.allowCustomBrand ? form : { name: form.name, sector: form.sector };
    const ok = await call('/api/settings/org', 'PATCH', payload);
    setSaving(false);
    if (!ok) return;
    toast.success(t('saved'));
    setEditing(false);
    onRefresh();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5 text-primary" /> {t('organization')}
          </h2>
          {!editing && canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> {tc('edit')}
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Field label={t('name')} htmlFor="org-name">
              <Input id="org-name" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('sector')} htmlFor="org-sector">
              <Select id="org-sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {sectorLabel(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('brandColor')} htmlFor="org-color">
              <div className="flex items-center gap-2">
                <input
                  id="org-color"
                  type="color"
                  value={form.brandColor}
                  disabled={!limits.allowCustomBrand}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="font-mono text-xs text-muted-foreground">{form.brandColor}</span>
              </div>
              {!limits.allowCustomBrand && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> {t('brandLocked')}
                </p>
              )}
            </Field>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? tc('saving') : tc('save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setForm({ name: org.name, sector: org.sector, brandColor: org.brandColor });
                  setEditing(false);
                }}
              >
                {tc('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">{t('name')}</dt>
            <dd className="font-medium">{org.name}</dd>
            <dt className="text-muted-foreground">{t('slug')}</dt>
            <dd className="font-mono text-xs" dir="ltr">
              {org.slug}
            </dd>
            <dt className="text-muted-foreground">{t('sector')}</dt>
            <dd>{sectorLabel(org.sector)}</dd>
            <dt className="text-muted-foreground">{t('plan')}</dt>
            <dd>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {tp.has(org.plan) ? tp(org.plan) : org.plan}
              </span>
            </dd>
            <dt className="text-muted-foreground">{t('brandColor')}</dt>
            <dd className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: org.brandColor }} />
              <span className="font-mono text-xs">{org.brandColor}</span>
            </dd>
          </dl>
        )}

        <div className="mt-6 border-t pt-4">
          <LogoUploader
            logoUrl={org.logoUrl}
            orgName={org.name}
            allowed={limits.allowCustomBrand}
            canEdit={canEdit}
            onChange={onRefresh}
          />
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="mb-3 text-xs font-medium uppercase text-muted-foreground">{t('usage')}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <UsageBar label={t('usageBranches')} used={usage.branches} max={limits.maxBranches} />
            <UsageBar label={t('usageEmployees')} used={usage.employees} max={limits.maxEmployees} />
            <UsageBar label={t('usageServices')} used={usage.services} max={limits.maxServices} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const t = useTranslations('settings');
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{t('usageValue', { used, max })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Agence ───────────────────────────────────────────────────────────────────

function BranchCard({ branch, limits, usage, onRefresh }: { branch: Branch; limits: Limits; usage: Usage; onRefresh: () => void }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const call = useApiCall();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: branch.name, address: branch.address ?? '', timezone: branch.timezone });
  const [saving, setSaving] = useState(false);

  const timezones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return all.includes(branch.timezone) ? all : [branch.timezone, ...all];
  }, [branch.timezone]);

  async function saveInfo() {
    setSaving(true);
    const ok = await call(`/api/settings/branches/${branch.id}`, 'PATCH', {
      name: form.name.trim(),
      address: form.address.trim() || null,
      timezone: form.timezone,
    });
    setSaving(false);
    if (!ok) return;
    toast.success(t('saved'));
    setEditing(false);
    onRefresh();
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{branch.name}</h3>
            {branch.address && <p className="mt-0.5 text-xs text-muted-foreground">{branch.address}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
              {branch.timezone}
            </p>
          </div>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> {tc('edit')}
            </Button>
          )}
        </div>

        {editing && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <Field label={t('branchName')} htmlFor={`bn-${branch.id}`}>
              <Input id={`bn-${branch.id}`} value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('address')} htmlFor={`ba-${branch.id}`}>
              <Input
                id={`ba-${branch.id}`}
                value={form.address}
                maxLength={200}
                placeholder={t('addressPlaceholder')}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label={t('timezone')} htmlFor={`bt-${branch.id}`}>
              <Select id={`bt-${branch.id}`} dir="ltr" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveInfo} disabled={saving || !form.name.trim()}>
                {saving ? tc('saving') : tc('save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setForm({ name: branch.name, address: branch.address ?? '', timezone: branch.timezone });
                  setEditing(false);
                }}
              >
                {tc('cancel')}
              </Button>
            </div>
          </div>
        )}

        <OpeningHoursEditor branch={branch} onRefresh={onRefresh} />
        <BookingSettings branch={branch} allowed={limits.allowBooking} onRefresh={onRefresh} />

        <ResourceList
          title={t('services')}
          addLabel={t('addService')}
          canAdd={usage.services < limits.maxServices}
          limitReached={usage.services >= limits.maxServices}
          onAdd={(name, duration) =>
            call(`/api/settings/branches/${branch.id}/services`, 'POST', { name, avgDurationMin: duration }).then((r) => {
              if (r) onRefresh();
              return !!r;
            })
          }
          withDuration
        >
          {branch.services.map((s) => (
            <ResourceRow
              key={s.id}
              name={s.name}
              active={s.active}
              duration={s.avgDurationMin}
              confirmMessage={t('confirmDeleteService', { name: s.name })}
              endpoint={`/api/settings/services/${s.id}`}
              onChanged={onRefresh}
            />
          ))}
        </ResourceList>

        <ResourceList
          title={t('employees')}
          addLabel={t('addEmployee')}
          canAdd={usage.employees < limits.maxEmployees}
          limitReached={usage.employees >= limits.maxEmployees}
          onAdd={(name) =>
            call(`/api/settings/branches/${branch.id}/employees`, 'POST', { name }).then((r) => {
              if (r) onRefresh();
              return !!r;
            })
          }
        >
          {branch.employees.map((e) => (
            <ResourceRow
              key={e.id}
              name={e.name}
              active={e.active}
              confirmMessage={t('confirmDeleteEmployee', { name: e.name })}
              endpoint={`/api/settings/employees/${e.id}`}
              onChanged={onRefresh}
            />
          ))}
        </ResourceList>
      </CardContent>
    </Card>
  );
}

// ─── Horaires d'ouverture ─────────────────────────────────────────────────────

const DAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function defaultHours(): OpenHours {
  return Object.fromEntries(
    DAY_ORDER.map((d) => [d, d === 'sun' ? { closed: true } : { open: '09:00', close: '19:00' }])
  ) as OpenHours;
}

function OpeningHoursEditor({ branch, onRefresh }: { branch: Branch; onRefresh: () => void }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const locale = useLocale();
  const call = useApiCall();
  const [hours, setHours] = useState<OpenHours | null>(branch.openHours);
  const [saving, setSaving] = useState(false);

  async function save(value: OpenHours | null) {
    setSaving(true);
    const ok = await call(`/api/settings/branches/${branch.id}`, 'PATCH', { openHours: value });
    setSaving(false);
    if (!ok) return;
    toast.success(t('saved'));
    onRefresh();
  }

  function update(day: Weekday, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    setHours((h) => {
      const current = h?.[day] ?? { open: '09:00', close: '19:00' };
      return { ...(h ?? {}), [day]: { ...current, ...patch } };
    });
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <Clock className="h-4 w-4" /> {t('openingHours')}
        </h4>
        {hours && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive hover:underline"
            onClick={() => {
              setHours(null);
              save(null);
            }}
          >
            {t('openingHoursDisable')}
          </button>
        )}
      </div>
      {!hours ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('openingHoursOff')}</span>
          <Button size="sm" variant="outline" onClick={() => setHours(defaultHours())}>
            {t('openingHoursEnable')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('openingHoursHint')}</p>
          <div className="divide-y rounded-lg border">
            {DAY_ORDER.map((day) => {
              const conf = hours[day] ?? { open: '09:00', close: '19:00' };
              const closed = !!conf.closed;
              return (
                <div key={day} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-24 font-medium">{weekdayName(WEEKDAYS.indexOf(day), locale, 'long')}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={closed} onChange={(e) => update(day, { closed: e.target.checked })} />
                    {t('closedDay')}
                  </label>
                  {!closed && (
                    <div className="ms-auto flex items-center gap-2" dir="ltr">
                      <input
                        type="time"
                        aria-label={t('open')}
                        value={conf.open ?? '09:00'}
                        onChange={(e) => update(day, { open: e.target.value })}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="time"
                        aria-label={t('close')}
                        value={conf.close ?? '19:00'}
                        onChange={(e) => update(day, { close: e.target.value })}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button size="sm" onClick={() => save(hours)} disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </div>
      )}
    </section>
  );
}

// ─── Réservation ──────────────────────────────────────────────────────────────

function BookingSettings({ branch, allowed, onRefresh }: { branch: Branch; allowed: boolean; onRefresh: () => void }) {
  const t = useTranslations('settings');
  const call = useApiCall();
  const [pending, setPending] = useState(false);

  async function patch(data: { allowBooking?: boolean; bookingSlotMin?: number }) {
    setPending(true);
    const ok = await call(`/api/settings/branches/${branch.id}`, 'PATCH', data);
    setPending(false);
    if (ok) {
      toast.success(t('saved'));
      onRefresh();
    }
  }

  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <CalendarDays className="h-4 w-4" /> {t('booking')}
      </h4>
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted px-3 py-2 text-sm">
        <label className={cn('flex items-center gap-2', !allowed && 'opacity-60')}>
          <input
            type="checkbox"
            checked={allowed && branch.allowBooking}
            disabled={!allowed || pending}
            onChange={(e) => patch({ allowBooking: e.target.checked })}
          />
          {t('allowBooking')}
        </label>
        {allowed && branch.allowBooking && (
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('slotDuration')}</span>
            <select
              value={branch.bookingSlotMin}
              disabled={pending}
              onChange={(e) => patch({ bookingSlotMin: Number(e.target.value) })}
              className="rounded border bg-background px-2 py-1"
            >
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        {!allowed && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {t('bookingLocked')}
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Prestations / employés ───────────────────────────────────────────────────

function ResourceList({
  title,
  addLabel,
  canAdd,
  limitReached,
  onAdd,
  withDuration,
  children,
}: {
  title: string;
  addLabel: string;
  canAdd: boolean;
  limitReached: boolean;
  onAdd: (name: string, duration: number) => Promise<boolean>;
  withDuration?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(20);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    setBusy(true);
    const ok = await onAdd(name.trim(), duration);
    setBusy(false);
    if (ok) {
      setName('');
      setDuration(20);
      setOpen(false);
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</h4>
      <ul className="space-y-1.5">{children}</ul>
      {open ? (
        <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border bg-background p-3">
          <div className="flex gap-2">
            <Input
              className="h-9 flex-1 text-sm"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder={withDuration ? t('serviceName') : t('employeeName')}
              autoFocus
            />
            {withDuration && (
              <label className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-9 w-20 text-sm"
                  value={duration}
                  min={1}
                  max={480}
                  aria-label={t('duration')}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">{tc('min')}</span>
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy}>
              {busy ? tc('adding') : tc('add')}
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tc('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!canAdd}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
          {limitReached && (
            <span className="ms-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> {tc('upgrade')}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function ResourceRow({
  name,
  active,
  duration,
  confirmMessage,
  endpoint,
  onChanged,
}: {
  name: string;
  active: boolean;
  duration?: number;
  confirmMessage: string;
  endpoint: string;
  onChanged: () => void;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const call = useApiCall();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name, duration: duration ?? 20 });
  const [busy, setBusy] = useState(false);

  async function run(method: string, json?: unknown) {
    setBusy(true);
    const res = await call<{ archived?: boolean }>(endpoint, method, json);
    setBusy(false);
    if (!res) return false;
    if (res.archived) toast(t('archived'));
    onChanged();
    return true;
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg bg-muted px-3 py-2">
        <div className="flex gap-2">
          <Input className="h-8 flex-1 text-sm" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {duration !== undefined && (
            <label className="flex items-center gap-1">
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={form.duration}
                min={1}
                max={480}
                aria-label={t('duration')}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              />
              <span className="text-xs text-muted-foreground">{tc('min')}</span>
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={busy || !form.name.trim()}
            onClick={async () => {
              const ok = await run(
                'PATCH',
                duration !== undefined ? { name: form.name.trim(), avgDurationMin: form.duration } : { name: form.name.trim() }
              );
              if (ok) setEditing(false);
            }}
          >
            {tc('save')}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setEditing(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
      <span className={cn('min-w-0 truncate', !active && 'text-muted-foreground line-through')}>{name}</span>
      <div className="flex shrink-0 items-center gap-1">
        {duration !== undefined && <span className="me-2 text-xs text-muted-foreground">~{duration} {tc('min')}</span>}
        <IconAction label={tc('edit')} onClick={() => setEditing(true)} disabled={busy}>
          <Pencil className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction label={active ? tc('disable') : tc('enable')} onClick={() => run('PATCH', { active: !active })} disabled={busy}>
          <Power className={cn('h-3.5 w-3.5', active ? 'text-emerald-600' : 'text-muted-foreground')} />
        </IconAction>
        <IconAction
          label={tc('delete')}
          onClick={() => {
            if (confirm(confirmMessage)) run('DELETE');
          }}
          disabled={busy}
          destructive
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconAction>
      </div>
    </li>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-md p-1.5 transition-colors hover:bg-background disabled:opacity-50',
        destructive ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

// ─── Nouvelle succursale ──────────────────────────────────────────────────────

function AddBranchForm({ disabled, max, onAdded }: { disabled: boolean; max: number; onAdded: () => void }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const call = useApiCall();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await call('/api/settings/branches', 'POST', { name: name.trim(), address: address.trim() || null });
    setBusy(false);
    if (!ok) return;
    toast.success(t('branchCreated'));
    setName('');
    setAddress('');
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
          <Plus className="h-4 w-4" /> {t('addBranch')}
        </Button>
        {disabled && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {te('plan_limit_branches', { limit: max })}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-3">
          <Field label={t('branchName')} htmlFor="new-branch-name">
            <Input id="new-branch-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus required />
          </Field>
          <Field label={t('address')} htmlFor="new-branch-address">
            <Input
              id="new-branch-address"
              value={address}
              maxLength={200}
              placeholder={t('addressPlaceholder')}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? tc('adding') : tc('add')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tc('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
