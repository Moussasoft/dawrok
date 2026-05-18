import { prisma } from './db';
import type { SessionPayload } from './auth';

type LogInput = {
  action: string;
  session?: SessionPayload | null;
  orgId?: string | null;
  branchId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function audit(input: LogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        orgId: input.orgId ?? input.session?.orgId ?? null,
        branchId: input.branchId ?? null,
        actorId: input.session?.userId,
        actorName: input.session?.name,
        actorEmail: input.session?.email,
        isSuperadmin: input.session?.isSuperadmin ?? false,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (e) {
    // Audit failures should never break the main flow
    console.error('[audit] failed:', e);
  }
}
