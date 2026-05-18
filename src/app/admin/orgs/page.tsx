import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrgRowActions } from './org-row-actions';

export const dynamic = 'force-dynamic';

const PLAN_PRICES: Record<string, number> = { free: 0, starter: 19, pro: 49, business: 129 };

export default async function AdminOrgsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { branches: true, users: true } },
      users: { where: { role: 'owner' }, select: { email: true, name: true }, take: 1 },
    },
  });

  // ticket counts per org last 30d
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const ticketsByOrg = await prisma.ticket.groupBy({
    by: ['branchId'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const branches = await prisma.branch.findMany({ select: { id: true, orgId: true } });
  const branchToOrg = new Map(branches.map((b) => [b.id, b.orgId]));
  const ticketsByOrgId = new Map<string, number>();
  for (const r of ticketsByOrg) {
    const orgId = branchToOrg.get(r.branchId);
    if (!orgId) continue;
    ticketsByOrgId.set(orgId, (ticketsByOrgId.get(orgId) ?? 0) + r._count._all);
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-1">Organisations</h1>
      <p className="text-muted-foreground mb-6">{orgs.length} organisation{orgs.length > 1 ? 's' : ''} inscrite{orgs.length > 1 ? 's' : ''}.</p>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Nom</th>
                <th className="p-3 font-medium">Secteur</th>
                <th className="p-3 font-medium">Owner</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium text-right">MRR</th>
                <th className="p-3 font-medium text-right">Tickets 30j</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{o.slug}</div>
                  </td>
                  <td className="p-3 capitalize">{o.sector.replace('_', ' ')}</td>
                  <td className="p-3">
                    <div>{o.users[0]?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{o.users[0]?.email ?? ''}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary capitalize">
                      {o.plan}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {o.suspended ? '—' : `${PLAN_PRICES[o.plan] ?? 0} €`}
                  </td>
                  <td className="p-3 text-right tabular-nums">{ticketsByOrgId.get(o.id) ?? 0}</td>
                  <td className="p-3">
                    {o.suspended ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        Suspendu
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <OrgRowActions orgId={o.id} suspended={o.suspended} />
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    Aucune organisation pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-muted-foreground">
        💡 « Imiter » vous connecte en tant qu'owner pour debug — toutes vos actions sont auditables.
      </div>
    </div>
  );
}
