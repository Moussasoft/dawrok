import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { SECTORS } from '@/lib/sectors';
import { DEFAULT_BRAND_COLOR, getOrgLimits } from '@/lib/plans';
import { publishBranchUpdate } from '@/lib/queue';
import { isRetentionChoice } from '@/lib/retention-rules';
import { audit } from '@/lib/audit';
import { SMS_CHANNELS } from '@/lib/sms';

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sector: z.enum(SECTORS).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  retentionDays: z.number().int().refine(isRetentionChoice).optional(),
  smsEnabled: z.boolean().optional(),
  smsChannel: z.enum(SMS_CHANNELS).optional(),
});

export const PATCH = route(async (req) => {
  const auth = await requireOrgRole('owner');
  const data = await parseBody(req, schema);

  if (data.brandColor && data.brandColor.toLowerCase() !== DEFAULT_BRAND_COLOR.toLowerCase()) {
    const limits = await getOrgLimits(auth.orgId);
    if (!limits.allowCustomBrand) throw new ApiError(403, 'plan_feature_custombrand', { plan: limits.plan });
  }
  if (data.smsEnabled) {
    const limits = await getOrgLimits(auth.orgId);
    if (limits.smsQuota <= 0) throw new ApiError(403, 'plan_feature_sms', { plan: limits.plan });
  }

  const before = await prisma.organization.findUnique({
    where: { id: auth.orgId },
    select: { retentionDays: true, smsEnabled: true, smsChannel: true },
  });
  const org = await prisma.organization.update({
    where: { id: auth.orgId },
    data,
    select: { id: true, name: true, sector: true, brandColor: true, retentionDays: true, smsEnabled: true, smsChannel: true },
  });
  if (data.retentionDays !== undefined && data.retentionDays !== before?.retentionDays) {
    await audit({ action: 'org.retention', actor: auth, metadata: { from: before?.retentionDays, to: data.retentionDays } });
  }
  if (org.smsEnabled !== before?.smsEnabled || org.smsChannel !== before?.smsChannel) {
    await audit({ action: 'org.sms', actor: auth, metadata: { enabled: org.smsEnabled, channel: org.smsChannel } });
  }
  const branches = await prisma.branch.findMany({ where: { orgId: auth.orgId }, select: { id: true } });
  await Promise.all(branches.map((b) => publishBranchUpdate(b.id)));
  return NextResponse.json(org);
});
