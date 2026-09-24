import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getSnapshot, getTicketView } from '@/lib/queue';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LiveTicket } from './live-ticket';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('ticket');
  return { title: t('yourTicket'), robots: { index: false } };
}

export default async function TicketPage({ params }: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { publicCode },
    select: { publicCode: true, branchId: true, cancelToken: true },
  });
  if (!ticket) notFound();

  // Rendu initial immédiat (pas d'écran de chargement), puis mise à jour en direct via SSE.
  const initial = await getTicketView(await getSnapshot(ticket.branchId), ticket);
  if (!initial) notFound();
  const t = await getTranslations('ticket');

  return (
    <main className="gradient-mesh flex min-h-screen flex-col">
      <div className="container mx-auto flex max-w-md flex-1 flex-col py-6">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <LiveTicket publicCode={publicCode} initial={initial} />
        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">{t('keepOpen')}</p>
      </div>
    </main>
  );
}
