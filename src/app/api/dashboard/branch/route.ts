import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { BRANCH_COOKIE, requireOwnBranch } from '@/lib/branch';

const schema = z.object({ branchId: z.string().min(1).max(64) });

// Sélection de l'agence active du dashboard (multi-succursales).
export const POST = route(async (req) => {
  const auth = await requireOrg();
  const { branchId } = await parseBody(req, schema);
  await requireOwnBranch(auth, branchId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BRANCH_COOKIE, branchId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
});
