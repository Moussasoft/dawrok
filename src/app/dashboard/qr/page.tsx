import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { CopyLink } from './copy-link';

export const dynamic = 'force-dynamic';

export default async function QrPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branch = await prisma.branch.findFirst({
    where: { orgId: session.orgId },
    include: { organization: true },
  });
  if (!branch) redirect('/dashboard');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/q/${branch.qrToken}`;

  return (
    <div className="container py-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Votre QR code</h1>
      <p className="text-muted-foreground mb-6">
        Imprimez ce QR code et placez-le à l'entrée. Vos clients le scannent pour prendre leur ticket.
      </p>

      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-6">
          <div className="rounded-2xl overflow-hidden border bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${branch.qrToken}`} alt="QR code" width={400} height={400} className="block" />
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Lien public</div>
            <CopyLink url={url} />
          </div>
          <a
            href={`/api/qr/${branch.qrToken}`}
            download={`daourak-${branch.organization.slug}.png`}
            className="text-sm text-primary hover:underline"
          >
            Télécharger le QR (PNG)
          </a>
          <a
            href="/poster"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            🖨️ Poster A4 imprimable
          </a>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 rounded-xl bg-muted text-sm">
        <strong>💡 Astuce :</strong> imprimez le QR au format A5, plastifiez-le, et collez-le à hauteur des yeux à l'entrée.
        Ajoutez une phrase comme « Scannez pour prendre votre tour ».
      </div>
    </div>
  );
}
