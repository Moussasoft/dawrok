import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Logo public d'une organisation (affiché sur la TV, la page client, l'affiche…).
// L'URL est versionnée (?v=) : on peut la mettre en cache très longtemps.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const org = await prisma.organization.findUnique({ where: { id }, select: { logoData: true, logoMime: true } });
  if (!org?.logoData || !org.logoMime) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(org.logoData), {
    headers: {
      'Content-Type': org.logoMime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
