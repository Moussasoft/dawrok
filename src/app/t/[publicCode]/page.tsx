import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { LiveTicket } from './live-ticket';

export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { publicCode },
    include: { branch: { include: { organization: true } }, service: true },
  });
  if (!ticket) notFound();

  return (
    <main className="min-h-screen gradient-mesh flex flex-col">
      <div className="container max-w-md mx-auto flex-1 flex flex-col py-6">
        <div className="text-center mb-6">
          <div className="text-sm text-muted-foreground">{ticket.branch.organization.name}</div>
          <div className="text-base font-medium">{ticket.branch.name}</div>
        </div>

        <div className="rounded-3xl bg-card border p-6 shadow-md text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Votre ticket</div>
          <div className="text-6xl font-extrabold tabular-nums my-2 text-primary">
            #{String(ticket.number).padStart(3, '0')}
          </div>
          <div className="text-sm text-muted-foreground">{ticket.customerName}</div>
          {ticket.service && (
            <div className="inline-block mt-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
              {ticket.service.name}
            </div>
          )}
        </div>

        <div className="mt-6">
          <LiveTicket publicCode={publicCode} />
        </div>

        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">
          Gardez cette page ouverte. Vous serez prévenu à l'approche de votre tour.
        </p>
      </div>
    </main>
  );
}
