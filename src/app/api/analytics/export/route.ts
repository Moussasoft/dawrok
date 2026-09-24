import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { getActiveBranch } from '@/lib/branch';
import { assertFeature } from '@/lib/plans';
import { DEFAULT_TIMEZONE, getZonedParts } from '@/lib/time';
import { effectiveTime } from '@/lib/queue-logic';
import { MESSAGES, toAppLocale } from '@/i18n/messages';
import { csvEscape } from '@/lib/csv';
import { isTicketStatus } from '@/lib/ticket-status';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  'number',
  'date',
  'time',
  'customer',
  'phone',
  'service',
  'employee',
  'status',
  'kind',
  'scheduledFor',
  'serviceMin',
  'waitMin',
  'rating',
  'comment',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export const GET = route(async (req) => {
  const auth = await requireOrgRole('manager');
  await assertFeature(auth.orgId, 'allowAnalytics');
  const branch = await getActiveBranch(auth);
  if (!branch) throw new ApiError(404, 'branch_not_found');

  const locale = toAppLocale(req.nextUrl.searchParams.get('locale'));
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'csv' });
  const tz = branch.timezone || DEFAULT_TIMEZONE;

  const since = new Date(Date.now() - 90 * 86_400_000);
  const tickets = await prisma.ticket.findMany({
    where: { branchId: branch.id, createdAt: { gte: since } },
    include: { service: true, employee: true, feedback: { select: { rating: true, comment: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const lines: string[] = [COLUMNS.map((c) => csvEscape(t(`columns.${c}`))).join(',')];
  for (const tk of tickets) {
    const p = getZonedParts(tk.createdAt, tz);
    const wait = tk.calledAt ? Math.round((tk.calledAt.getTime() - effectiveTime(tk)) / 60000) : '';
    const dur = tk.startedAt && tk.completedAt ? Math.round((tk.completedAt.getTime() - tk.startedAt.getTime()) / 60000) : '';
    const sched = tk.scheduledFor ? getZonedParts(tk.scheduledFor, tz) : null;
    lines.push(
      [
        tk.number,
        `${p.year}-${pad(p.month)}-${pad(p.day)}`,
        `${pad(p.hour)}:${pad(p.minute)}`,
        tk.customerName,
        tk.customerPhone ?? '',
        tk.service?.name ?? '',
        tk.employee?.name ?? '',
        isTicketStatus(tk.status) ? t(`statuses.${tk.status}`) : tk.status,
        t(`kinds.${tk.kind === 'appointment' ? 'appointment' : 'walkin'}`),
        sched ? `${sched.year}-${pad(sched.month)}-${pad(sched.day)} ${pad(sched.hour)}:${pad(sched.minute)}` : '',
        dur,
        wait,
        tk.feedback?.rating ?? '',
        tk.feedback?.comment ?? '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const filename = `daourak-${branch.id.slice(-6)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
