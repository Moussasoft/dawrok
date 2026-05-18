import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PublicQueueClient } from './public-queue-client';

export const dynamic = 'force-dynamic';

export default async function PublicQueuePage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const branch = await prisma.branch.findUnique({
    where: { qrToken },
    include: {
      organization: true,
      services: { where: { active: true }, orderBy: { name: 'asc' } },
    },
  });
  if (!branch || !branch.active) notFound();

  // Quick stat: how many waiting now
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const waitingCount = await prisma.ticket.count({
    where: {
      branchId: branch.id,
      status: { in: ['waiting', 'called', 'in_progress'] },
      createdAt: { gte: startOfDay },
    },
  });

  return (
    <main className="min-h-screen gradient-mesh flex flex-col">
      <div className="container max-w-md mx-auto flex-1 flex flex-col py-6">
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
            {branch.organization.name}
          </div>
          <h1 className="text-3xl font-bold">{branch.name}</h1>
          {branch.address && <p className="text-muted-foreground mt-1">{branch.address}</p>}
        </div>

        <div className="rounded-2xl bg-card border p-4 text-center mb-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Personnes actuellement en file</div>
          <div className="text-4xl font-extrabold mt-1 tabular-nums">{waitingCount}</div>
        </div>

        {branch.closedUntil && branch.closedUntil.getTime() > Date.now() ? (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-6 text-center mb-4">
            <div className="text-3xl">🔒</div>
            <h3 className="mt-2 font-bold">File temporairement fermée</h3>
            {branch.closureReason && <p className="text-sm mt-1">{branch.closureReason}</p>}
            <p className="text-xs text-muted-foreground mt-2">
              Réouverture : {branch.closedUntil.toLocaleString('fr-FR')}
            </p>
          </div>
        ) : (
          <PublicQueueClient
            qrToken={qrToken}
            allowBooking={branch.allowBooking}
            services={branch.services.map((s) => ({ id: s.id, name: s.name, durationMin: s.avgDurationMin }))}
          />
        )}

        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold">Daourak</span>
        </p>
      </div>
    </main>
  );
}
