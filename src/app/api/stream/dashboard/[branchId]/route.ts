import { NextRequest } from 'next/server';
import { ApiError, route } from '@/lib/api';
import { getSession, resolveAuth } from '@/lib/auth';
import { requireOrg } from '@/lib/guards';
import { requireOwnBranch } from '@/lib/branch';
import { followBranch } from '@/lib/queue';
import { sseResponse } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REVALIDATE_MS = 60_000;

// Flux AUTHENTIFIÉ du dashboard : données complètes, réservé à l'organisation propriétaire.
export const GET = route<{ params: Promise<{ branchId: string }> }>(async (req: NextRequest, ctx) => {
  const auth = await requireOrg();
  const session = await getSession();
  if (!session) throw new ApiError(401, 'unauthenticated');
  const { branchId } = await ctx.params;
  const branch = await requireOwnBranch(auth, branchId);

  return sseResponse(req, async (send, close) => {
    const unsubscribe = await followBranch(branch.id, send);
    // Une connexion ouverte ne doit pas survivre à une révocation ou à une suspension.
    const timer = setInterval(async () => {
      try {
        const current = await resolveAuth(session);
        if (!current || current.orgId !== auth.orgId || (current.orgSuspended && !current.isSuperadmin)) close();
      } catch {
        /* base momentanément indisponible : on réessaiera */
      }
    }, REVALIDATE_MS);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  });
});
