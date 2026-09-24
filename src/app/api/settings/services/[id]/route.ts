import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrg, type OrgAuth } from '@/lib/guards';
import { publishBranchUpdate } from '@/lib/queue';
import { assertCanAdd } from '@/lib/plans';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avgDurationMin: z.number().int().min(1).max(480).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function findOwnService(auth: OrgAuth, id: string) {
  const service = await prisma.service.findFirst({ where: { id, branch: { orgId: auth.orgId } } });
  if (!service) throw new ApiError(404, 'not_found');
  return service;
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  const service = await findOwnService(auth, id);
  const data = await parseBody(req, patchSchema);
  // Réactiver compte dans la limite de l'offre, comme une création.
  if (data.active === true && !service.active) await assertCanAdd(auth.orgId, 'services');
  const updated = await prisma.service.update({ where: { id }, data });
  await publishBranchUpdate(service.branchId);
  return NextResponse.json(updated);
});

// Un service déjà utilisé est archivé (désactivé) plutôt que supprimé, pour garder l'historique.
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  const service = await findOwnService(auth, id);
  const used = await prisma.ticket.count({ where: { serviceId: id } });
  if (used > 0) {
    await prisma.service.update({ where: { id }, data: { active: false } });
    await publishBranchUpdate(service.branchId);
    return NextResponse.json({ ok: true, archived: true });
  }
  await prisma.service.delete({ where: { id } });
  await publishBranchUpdate(service.branchId);
  return NextResponse.json({ ok: true, archived: false });
});
