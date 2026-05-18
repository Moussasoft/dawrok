import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, AlertCircle, ShieldAlert, UserCog } from 'lucide-react';

export const dynamic = 'force-dynamic';

const actionLabels: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  'org.suspend': { label: 'Suspension organisation', icon: <AlertCircle className="h-4 w-4" />, tone: 'text-amber-600' },
  'org.reactivate': { label: 'Réactivation organisation', icon: <Activity className="h-4 w-4" />, tone: 'text-emerald-600' },
  'org.delete': { label: 'Suppression organisation', icon: <ShieldAlert className="h-4 w-4" />, tone: 'text-destructive' },
  'impersonate.start': { label: 'Imitation démarrée', icon: <UserCog className="h-4 w-4" />, tone: 'text-violet-600' },
  'impersonate.stop': { label: 'Imitation arrêtée', icon: <UserCog className="h-4 w-4" />, tone: 'text-muted-foreground' },
  'branch.close': { label: 'File fermée', icon: <AlertCircle className="h-4 w-4" />, tone: 'text-amber-600' },
  'branch.reopen': { label: 'File rouverte', icon: <Activity className="h-4 w-4" />, tone: 'text-emerald-600' },
  'ticket.cancel.client': { label: 'Annulation client', icon: <Activity className="h-4 w-4" />, tone: 'text-muted-foreground' },
};

export default async function AuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // org name lookup
  const orgIds = Array.from(new Set(logs.map((l) => l.orgId).filter(Boolean) as string[]));
  const orgs = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="container py-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Journal d&apos;audit</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Historique des actions sensibles (200 dernières)
      </p>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
            Aucune action enregistrée pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {logs.map((l) => {
                const meta = actionLabels[l.action] ?? {
                  label: l.action,
                  icon: <Activity className="h-4 w-4" />,
                  tone: 'text-muted-foreground',
                };
                let metaParsed: Record<string, unknown> | null = null;
                try {
                  metaParsed = l.metadata ? JSON.parse(l.metadata) : null;
                } catch {
                  /* */
                }
                return (
                  <li key={l.id} className="p-4 flex items-start gap-3">
                    <div className={`mt-0.5 ${meta.tone}`}>{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{meta.label}</span>
                        {l.isSuperadmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                            SUPERADMIN
                          </span>
                        )}
                        {l.orgId && orgName.get(l.orgId) && (
                          <span className="text-xs text-muted-foreground">
                            · {orgName.get(l.orgId)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Par <span className="font-medium">{l.actorName ?? l.actorEmail ?? 'système'}</span>
                        {' · '}
                        {new Date(l.createdAt).toLocaleString('fr-FR')}
                      </div>
                      {metaParsed && (
                        <pre className="mt-2 text-[11px] text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto">
                          {JSON.stringify(metaParsed, null, 2)}
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
