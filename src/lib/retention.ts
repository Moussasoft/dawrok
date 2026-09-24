// Purge des données expirées (loi 09-08), lancée chaque jour par le planificateur ou /api/cron/retention.
// Idempotente : la relancer ne supprime rien de plus.
import { prisma } from './db';
import { audit } from './audit';
import { TERMINAL_STATUSES } from './ticket-status';
import { ANONYMIZED_NAME, MIN_AUDIT_RETENTION_DAYS, auditCutoff, retentionCutoff } from './retention-rules';

export type PurgeReport = {
  ticketsAnonymized: number;
  customersDeleted: number;
  commentsCleared: number;
  auditDeleted: number;
  technicalDeleted: number;
};

const DAY_MS = 86_400_000;

export async function purgeExpiredData(now = new Date()): Promise<PurgeReport> {
  const report: PurgeReport = { ticketsAnonymized: 0, customersDeleted: 0, commentsCleared: 0, auditDeleted: 0, technicalDeleted: 0 };
  const orgs = await prisma.organization.findMany({ select: { id: true, retentionDays: true } });

  for (const org of orgs) {
    const cutoff = retentionCutoff(now, org.retentionDays);
    const inOrg = { orgId: org.id };
    const [tickets, comments, customers, logs] = await prisma.$transaction([
      // Tickets passés : on efface prénom et téléphone, les statistiques restent exploitables.
      prisma.ticket.updateMany({
        where: {
          branch: inOrg,
          createdAt: { lt: cutoff },
          status: { in: [...TERMINAL_STATUSES] },
          OR: [{ customerName: { not: ANONYMIZED_NAME } }, { customerPhone: { not: null } }, { customerId: { not: null } }],
        },
        data: { customerName: ANONYMIZED_NAME, customerPhone: null, customerId: null, cancelToken: null },
      }),
      prisma.feedback.updateMany({ where: { branch: inOrg, createdAt: { lt: cutoff }, comment: { not: null } }, data: { comment: null } }),
      // Fiche client sans aucune activité (ticket, visite) depuis la limite.
      prisma.customer.deleteMany({
        where: { branch: inOrg, updatedAt: { lt: cutoff }, OR: [{ lastVisitAt: null }, { lastVisitAt: { lt: cutoff } }] },
      }),
      prisma.auditLog.deleteMany({ where: { orgId: org.id, createdAt: { lt: auditCutoff(now, org.retentionDays) } } }),
    ]);
    report.ticketsAnonymized += tickets.count;
    report.commentsCleared += comments.count;
    report.customersDeleted += customers.count;
    report.auditDeleted += logs.count;
  }

  // Journaux sans organisation (plateforme, organisations supprimées) : un an.
  const auditLimit = retentionCutoff(now, MIN_AUDIT_RETENTION_DAYS);
  const knownOrgs = new Set(orgs.map((o) => o.id));
  const oldLogOrgs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: auditLimit }, orgId: { not: null } },
    select: { orgId: true },
    distinct: ['orgId'],
  });
  const orphanOrgIds = oldLogOrgs.map((l) => l.orgId!).filter((id) => !knownOrgs.has(id));
  const orphanLogs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditLimit }, OR: [{ orgId: null }, { orgId: { in: orphanOrgIds } }] },
  });
  report.auditDeleted += orphanLogs.count;

  // Nettoyage technique : liens expirés ou utilisés, compteurs anciens, abonnements push orphelins.
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const technical = await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] } }),
    prisma.invitation.deleteMany({ where: { OR: [{ acceptedAt: { lt: monthAgo } }, { expiresAt: { lt: monthAgo } }] } }),
    prisma.dailyCounter.deleteMany({ where: { day: { lt: monthAgo.toISOString().slice(0, 10) } } }),
    prisma.pushSubscription.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) }, ticket: { status: { in: [...TERMINAL_STATUSES] } } },
    }),
  ]);
  report.technicalDeleted = technical.reduce((sum, r) => sum + r.count, 0);

  const personal = report.ticketsAnonymized + report.customersDeleted + report.commentsCleared;
  if (personal > 0) await audit({ action: 'retention.purge', metadata: { ...report } });
  return report;
}
