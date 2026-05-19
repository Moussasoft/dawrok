import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, User, Calendar, X, Award } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session?.orgId) redirect('/login');
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';

  const branch = await prisma.branch.findFirst({ where: { orgId: session.orgId ?? undefined } });
  if (!branch) redirect('/dashboard');

  const customers = await prisma.customer.findMany({
    where: {
      branchId: branch.id,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ totalVisits: 'desc' }, { lastVisitAt: 'desc' }],
    take: 200,
    include: {
      _count: { select: { tickets: true } },
    },
  });

  return (
    <div className="container py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} clients fidèles enregistrés
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher (nom, téléphone)…"
            className="rounded-lg border bg-background px-3 py-2 text-sm w-64"
          />
        </form>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <div className="font-medium">Aucun client encore</div>
            <div className="text-sm text-muted-foreground mt-1">
              Les clients apparaîtront ici dès qu&apos;ils prendront un ticket avec leur numéro.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3 hidden sm:table-cell">Téléphone</th>
                <th className="text-right p-3">Visites</th>
                <th className="text-right p-3 hidden md:table-cell">No-show</th>
                <th className="text-right p-3 hidden md:table-cell">Dernière</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const isVip = c.totalVisits >= 10;
                return (
                  <tr key={c.id} className="border-t hover:bg-accent/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isVip && <Award className="h-4 w-4 text-amber-500" />}
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-muted-foreground">{c.phone}</td>
                    <td className="p-3 text-right font-bold tabular-nums">{c.totalVisits}</td>
                    <td className="p-3 text-right hidden md:table-cell">
                      {c.noShowCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs">
                          <X className="h-3 w-3" /> {c.noShowCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right hidden md:table-cell text-xs text-muted-foreground">
                      {c.lastVisitAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(c.lastVisitAt).toLocaleDateString('fr-FR')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
