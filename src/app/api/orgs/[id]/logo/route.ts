import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Logo public d'une organisation (affiché sur la TV, la page client, l'affiche…).
// L'URL est versionnée (?v=) : on peut la mettre en cache très longtemps.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const logo = await prisma.orgLogo.findUnique({ where: { orgId: id } });
  if (!logo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      'Content-Type': logo.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
