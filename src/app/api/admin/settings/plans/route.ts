import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { PLANS, getAllPlanLimits } from '@/lib/plans';
import { audit } from '@/lib/audit';

export const GET = route(async () => {
  await requireSuperadmin();
  return NextResponse.json({ configs: await getAllPlanLimits() });
});

const planSchema = z.object({
  plan: z.enum(PLANS),
  price: z.number().int().min(0).max(1_000_000),
  maxBranches: z.number().int().min(1).max(10_000),
  maxEmployees: z.number().int().min(1).max(100_000),
  maxServices: z.number().int().min(1).max(100_000),
  allowBooking: z.boolean(),
  allowAnalytics: z.boolean(),
  allowCustomBrand: z.boolean(),
  smsQuota: z.number().int().min(0).max(1_000_000),
});

export const PATCH = route(async (req) => {
  const auth = await requireSuperadmin();
  const { plan, ...data } = await parseBody(req, planSchema);
  await prisma.planConfig.upsert({ where: { plan }, update: data, create: { plan, ...data } });
  await audit({ action: 'plan.update', actor: auth, targetType: 'plan', targetId: plan, metadata: data });
  return NextResponse.json({ ok: true });
});
