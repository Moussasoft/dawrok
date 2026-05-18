import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const PLAN_DEFAULTS = [
  { plan: 'free',     price: 0,   maxBranches: 1,  maxEmployees: 3,   maxServices: 5,   allowBooking: false, allowAnalytics: false, allowCustomBrand: false },
  { plan: 'starter',  price: 19,  maxBranches: 2,  maxEmployees: 10,  maxServices: 15,  allowBooking: true,  allowAnalytics: false, allowCustomBrand: false },
  { plan: 'pro',      price: 49,  maxBranches: 5,  maxEmployees: 30,  maxServices: 50,  allowBooking: true,  allowAnalytics: true,  allowCustomBrand: false },
  { plan: 'business', price: 129, maxBranches: 20, maxEmployees: 200, maxServices: 200, allowBooking: true,  allowAnalytics: true,  allowCustomBrand: true  },
];

export async function GET() {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  // Seed defaults if not present
  for (const d of PLAN_DEFAULTS) {
    await prisma.planConfig.upsert({ where: { plan: d.plan }, update: {}, create: d });
  }

  const configs = await prisma.planConfig.findMany({ orderBy: { price: 'asc' } });
  return NextResponse.json({ configs });
}

const planSchema = z.object({
  plan:            z.enum(['free', 'starter', 'pro', 'business']),
  price:           z.number().int().min(0),
  maxBranches:     z.number().int().min(1),
  maxEmployees:    z.number().int().min(1),
  maxServices:     z.number().int().min(1),
  allowBooking:    z.boolean(),
  allowAnalytics:  z.boolean(),
  allowCustomBrand: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const { plan, ...data } = parsed.data;
  await prisma.planConfig.upsert({
    where: { plan },
    update: data,
    create: { plan, ...data },
  });

  return NextResponse.json({ ok: true });
}
