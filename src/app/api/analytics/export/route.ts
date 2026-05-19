import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await getSession();
  if (!session?.orgId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const branch = await prisma.branch.findFirst({ where: { orgId: session.orgId ?? undefined } });
  if (!branch) return NextResponse.json({ error: 'Aucune agence' }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const tickets = await prisma.ticket.findMany({
    where: { branchId: branch.id, createdAt: { gte: since } },
    include: { service: true, employee: true },
    orderBy: { createdAt: 'desc' },
  });

  const headers = [
    'numero',
    'date',
    'heure',
    'client',
    'telephone',
    'service',
    'employe',
    'statut',
    'type',
    'rdv_prevu',
    'duree_service_min',
    'attente_min',
  ];
  const lines: string[] = [headers.join(',')];

  for (const t of tickets) {
    const created = t.createdAt;
    const wait = t.startedAt
      ? Math.round((t.startedAt.getTime() - t.createdAt.getTime()) / 60000)
      : '';
    const dur =
      t.startedAt && t.completedAt
        ? Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60000)
        : '';
    lines.push(
      [
        t.number,
        created.toISOString().slice(0, 10),
        created.toISOString().slice(11, 16),
        t.customerName,
        t.customerPhone ?? '',
        t.service?.name ?? '',
        t.employee?.name ?? '',
        t.status,
        t.kind,
        t.scheduledFor?.toISOString() ?? '',
        dur,
        wait,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const filename = `daourak-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse('\uFEFF' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
