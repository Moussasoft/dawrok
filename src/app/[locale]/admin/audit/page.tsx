import { getLocale, getTranslations } from 'next-intl/server';
import { Activity, AlertCircle, ShieldAlert, UserCog, CreditCard, MapPin, Ticket, KeyRound } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSuperadminPage } from '@/lib/guards';
import { formatDateTime } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('auditTitle') };
}

const ACTION_STYLE: Record<string, { icon: React.ReactNode; tone: string }> = {
  org_suspend: { icon: <AlertCircle className="h-4 w-4" />, tone: 'text-amber-600' },
  org_reactivate: { icon: <Activity className="h-4 w-4" />, tone: 'text-emerald-600' },
  org_delete: { icon: <ShieldAlert className="h-4 w-4" />, tone: 'text-destructive' },
  org_plan: { icon: <CreditCard className="h-4 w-4" />, tone: 'text-violet-600' },
  plan_update: { icon: <CreditCard className="h-4 w-4" />, tone: 'text-violet-600' },
  impersonate_start: { icon: <UserCog className="h-4 w-4" />, tone: 'text-violet-600' },
  impersonate_stop: { icon: <UserCog className="h-4 w-4" />, tone: 'text-muted-foreground' },
  branch_close: { icon: <AlertCircle className="h-4 w-4" />, tone: 'text-amber-600' },
  branch_reopen: { icon: <Activity className="h-4 w-4" />, tone: 'text-emerald-600' },
  branch_create: { icon: <MapPin className="h-4 w-4" />, tone: 'text-primary' },
  ticket_cancel_client: { icon: <Ticket className="h-4 w-4" />, tone: 'text-muted-foreground' },
  ticket_cancel_staff: { icon: <Ticket className="h-4 w-4" />, tone: 'text-muted-foreground' },
  superadmin_invite: { icon: <ShieldAlert className="h-4 w-4" />, tone: 'text-violet-600' },
  superadmin_revoke: { icon: <ShieldAlert className="h-4 w-4" />, tone: 'text-destructive' },
  superadmin_password: { icon: <KeyRound className="h-4 w-4" />, tone: 'text-muted-foreground' },
};

export default async function AuditLogsPage() {
  await requireSuperadminPage();
  const [t, locale] = await Promise.all([getTranslations('admin'), getLocale()]);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });

  const orgIds = Array.from(new Set(logs.map((l) => l.orgId).filter((x): x is string => !!x)));
  const orgs = orgIds.length
    ? await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
    : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="container max-w-5xl py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('auditTitle')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('auditSubtitle')}</p>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Activity className="mx-auto mb-3 h-12 w-12 opacity-30" />
            {t('auditEmpty')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {logs.map((l) => {
                const key = l.action.replace(/\./g, '_');
                const style = ACTION_STYLE[key] ?? { icon: <Activity className="h-4 w-4" />, tone: 'text-muted-foreground' };
                const label = t.has(`actions.${key}`) ? t(`actions.${key}`) : l.action;
                let meta: Record<string, unknown> | null = null;
                try {
                  meta = l.metadata ? JSON.parse(l.metadata) : null;
                } catch {
                  /* métadonnées illisibles ignorées */
                }
                return (
                  <li key={l.id} className="flex items-start gap-3 p-4">
                    <div className={`mt-0.5 ${style.tone}`}>{style.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{label}</span>
                        {l.isSuperadmin && (
                          <span className="inline-flex items-center rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            SUPERADMIN
                          </span>
                        )}
                        {l.orgId && orgName.get(l.orgId) && <span className="text-xs text-muted-foreground">· {orgName.get(l.orgId)}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t('by')} <span className="font-medium">{l.actorName ?? l.actorEmail ?? t('system')}</span>
                        {' · '}
                        {formatDateTime(l.createdAt, locale)}
                      </div>
                      {meta && (
                        <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-[11px] text-muted-foreground" dir="ltr">
                          {JSON.stringify(meta, null, 2)}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
