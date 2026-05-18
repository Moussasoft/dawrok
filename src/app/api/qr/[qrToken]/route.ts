import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await ctx.params;
  const branch = await prisma.branch.findUnique({ where: { qrToken } });
  if (!branch) return new Response('Not found', { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/q/${qrToken}`;
  const png = await QRCode.toBuffer(url, { width: 600, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
