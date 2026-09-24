import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { ApiError, route } from '@/lib/api';
import { purgeExpiredData } from '@/lib/retention';

export const dynamic = 'force-dynamic';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Purge déclenchée par un cron externe (Vercel Cron, crontab…) : `Authorization: Bearer $CRON_SECRET`.
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(404, 'not_found');
  if (!sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) throw new ApiError(401, 'unauthenticated');
  return NextResponse.json({ ok: true, report: await purgeExpiredData() });
});
