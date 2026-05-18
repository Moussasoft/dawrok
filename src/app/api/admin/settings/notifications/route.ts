import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const CONFIG_KEY = 'notifications';

const DEFAULT_NOTIF = {
  newOrgSignup:  true,
  orgSuspended:  false,
  orgOverLimit:  false,
  dailyReport:   false,
  notifEmail:    '',
};

export async function GET() {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  const config = row ? JSON.parse(row.value) : DEFAULT_NOTIF;

  return NextResponse.json({ config });
}

const schema = z.object({
  newOrgSignup: z.boolean().optional(),
  orgSuspended: z.boolean().optional(),
  orgOverLimit: z.boolean().optional(),
  dailyReport:  z.boolean().optional(),
  notifEmail:   z.string().email().or(z.literal('')).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperadmin) return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  const existing = row ? JSON.parse(row.value) : DEFAULT_NOTIF;
  const merged = { ...existing, ...parsed.data };

  await prisma.systemConfig.upsert({
    where:  { key: CONFIG_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: CONFIG_KEY, value: JSON.stringify(merged) },
  });

  return NextResponse.json({ ok: true });
}
