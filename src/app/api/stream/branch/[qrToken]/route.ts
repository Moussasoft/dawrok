import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { followBranch } from '@/lib/queue';
import { toPublicSnapshot } from '@/lib/queue-logic';
import { sseResponse } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Flux PUBLIC (écran TV, page QR) : le qrToken est imprimé sur l'affiche, donc ce flux
// ne contient que des données anonymisées — ni prénom, ni code de ticket, ni identifiant.
export async function GET(req: NextRequest, ctx: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await ctx.params;
  const branch = await prisma.branch.findUnique({ where: { qrToken }, select: { id: true } });
  if (!branch) return new Response('Not found', { status: 404 });

  return sseResponse(req, (send) => followBranch(branch.id, (snap) => send(toPublicSnapshot(snap))));
}
