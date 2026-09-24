import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Lock, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getSnapshot } from '@/lib/queue';
import { getPlanLimits } from '@/lib/plans';
import { formatDateTime, weekdayName } from '@/lib/format';
import { LanguageSwitcher } from '@/components/language-switcher';
import { MyTicketBanner, PublicQueueClient } from './public-queue-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const branch = await prisma.branch.findUnique({ where: { qrToken }, select: { name: true } });
  return { title: branch?.name, robots: { index: false } };
}

export default async function PublicQueuePage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const branch = await prisma.branch.findUnique({
    where: { qrToken },
    include: { organization: true, services: { where: { active: true }, orderBy: { name: 'asc' } } },
  });
  if (!branch || !branch.active) notFound();
  const [t, locale, snap, limits] = await Promise.all([
    getTranslations(),
    getLocale(),
    getSnapshot(branch.id),
    getPlanLimits(branch.organization.plan),
  ]);
  const suspended = branch.organization.suspended;
  const waitingCount = snap.tickets.filter((x) => x.status === 'waiting').length;

  let closedNotice: React.ReactNode = null;
  if (suspended) {
    closedNotice = <ClosedCard icon={<Lock className="mx-auto h-8 w-8 text-amber-600" />} title={t('errors.service_unavailable')} />;
  } else if (snap.isPaused) {
    closedNotice = (
      <ClosedCard
        icon={<Lock className="mx-auto h-8 w-8 text-amber-600" />}
        title={t('publicQueue.closed')}
        detail={snap.closureReason}
        footer={snap.closedUntil ? `${t('publicQueue.reopen')} : ${formatDateTime(snap.closedUntil, locale, snap.timezone)}` : null}
      />
    );
  } else if (!snap.isOpenNow) {
    const next = snap.nextOpening;
    closedNotice = (
      <ClosedCard
        icon={<Clock className="mx-auto h-8 w-8 text-amber-600" />}
        title={t('publicQueue.closedNow')}
        footer={
          next
            ? next.today
              ? t('publicQueue.opensToday', { time: next.time })
              : t('publicQueue.opensOn', { day: weekdayName(next.weekday, locale, 'long'), time: next.time })
            : null
        }
      />
    );
  }

  const allowBooking = !suspended && branch.allowBooking && limits.allowBooking;

  return (
    <main className="gradient-mesh flex min-h-screen flex-col">
      <div className="container mx-auto flex max-w-md flex-1 flex-col py-6">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 text-center">
          {branch.organization.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branch.organization.logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-white object-contain p-1 shadow-sm" />
          )}
          <div className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            {branch.organization.name}
          </div>
          <h1 className="text-3xl font-bold">{branch.name}</h1>
          {branch.address && <p className="mt-1 text-muted-foreground">{branch.address}</p>}
        </div>

        <div className="mb-6 rounded-2xl border bg-card p-4 text-center shadow-sm">
          <div className="text-sm text-muted-foreground">{t('publicQueue.waitingCount')}</div>
          <div className="mt-1 text-4xl font-extrabold tabular-nums">{waitingCount}</div>
        </div>

        <MyTicketBanner qrToken={qrToken} />
        {closedNotice}
        {(!closedNotice || (allowBooking && !suspended)) && (
          <PublicQueueClient
            qrToken={qrToken}
            timezone={snap.timezone}
            canTakeTicket={!closedNotice}
            allowBooking={allowBooking}
            services={branch.services.map((s) => ({ id: s.id, name: s.name, durationMin: s.avgDurationMin }))}
          />
        )}

        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">{t('common.poweredBy')}</p>
      </div>
    </main>
  );
}

function ClosedCard({
  icon,
  title,
  detail,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string | null;
  footer?: string | null;
}) {
  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
      {icon}
      <h2 className="mt-2 font-bold">{title}</h2>
      {detail && <p className="mt-1 text-sm">{detail}</p>}
      {footer && <p className="mt-2 text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
