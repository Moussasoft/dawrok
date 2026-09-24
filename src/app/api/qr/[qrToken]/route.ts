import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/api';
import { routing } from '@/i18n/routing';

// QR code PNG de la page publique. `?locale=fr` encode l'URL dans cette langue.
export async function GET(req: NextRequest, ctx: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await ctx.params;
  const branch = await prisma.branch.findUnique({ where: { qrToken }, select: { id: true } });
  if (!branch) return new Response('Not found', { status: 404 });

  const locale = req.nextUrl.searchParams.get('locale');
  const prefix =
    locale && locale !== routing.defaultLocale && (routing.locales as readonly string[]).includes(locale) ? `/${locale}` : '';
  const url = `${appUrl(req).replace(/\/$/, '')}${prefix}/q/${qrToken}`;
  const png = await QRCode.toBuffer(url, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
