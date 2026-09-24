import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { SECTORS } from '@/lib/sectors';
import { DEFAULT_BRAND_COLOR, getOrgLimits } from '@/lib/plans';
import { publishBranchUpdate } from '@/lib/queue';

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sector: z.enum(SECTORS).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const PATCH = route(async (req) => {
  const auth = await requireOrg();
  const data = await parseBody(req, schema);

  if (data.brandColor && data.brandColor.toLowerCase() !== DEFAULT_BRAND_COLOR.toLowerCase()) {
    const limits = await getOrgLimits(auth.orgId);
    if (!limits.allowCustomBrand) throw new ApiError(403, 'plan_feature_custombrand', { plan: limits.plan });
  }

  const org = await prisma.organization.update({
    where: { id: auth.orgId },
    data,
    select: { id: true, name: true, sector: true, brandColor: true },
  });
  const branches = await prisma.branch.findMany({ where: { orgId: auth.orgId }, select: { id: true } });
  await Promise.all(branches.map((b) => publishBranchUpdate(b.id)));
  return NextResponse.json(org);
});
