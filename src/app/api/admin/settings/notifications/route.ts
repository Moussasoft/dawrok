import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, route } from '@/lib/api';
import { requireSuperadmin } from '@/lib/guards';
import { readNotificationsConfig, writeNotificationsConfig } from '@/lib/system-config';

export const GET = route(async () => {
  await requireSuperadmin();
  return NextResponse.json({ config: await readNotificationsConfig() });
});

const schema = z.object({
  newOrgSignup: z.boolean().optional(),
  orgSuspended: z.boolean().optional(),
  orgOverLimit: z.boolean().optional(),
  dailyReport: z.boolean().optional(),
  notifEmail: z.string().trim().email().or(z.literal('')).optional(),
});

export const PATCH = route(async (req) => {
  await requireSuperadmin();
  const data = await parseBody(req, schema);
  return NextResponse.json({ ok: true, config: await writeNotificationsConfig(data) });
});
