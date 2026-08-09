import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { TVScreen } from './tv-screen';

export const dynamic = 'force-dynamic';

// Public TV display for a branch — accessible via qrToken to avoid leaking internal IDs.
export default async function ScreenPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const branch = await prisma.branch.findUnique({
    where: { qrToken },
    include: { organization: true },
  });
  if (!branch) notFound();

  return (
    <TVScreen
      qrToken={qrToken}
      orgName={branch.organization.name}
      branchName={branch.name}
      brandColor={branch.organization.brandColor}
      logoUrl={branch.organization.logoUrl}
    />
  );
}
