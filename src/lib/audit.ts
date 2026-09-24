import { prisma } from './db';
import type { AuthContext } from './auth';

type LogInput = {
  action: string;
  /** Auteur : c'est toujours la personne réellement connectée (le superadmin pendant une imitation). */
  actor?: AuthContext | null;
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
        orgId: input.orgId ?? input.actor?.orgId ?? null,
        branchId: input.branchId ?? null,
        actorId: input.actor?.actorId,
        actorName: input.actor?.actorName,
        actorEmail: input.actor?.actorEmail,
        isSuperadmin: input.actor?.isSuperadmin ?? false,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (e) {
    // Un échec d'audit ne doit jamais casser l'action principale
    console.error('[audit] échec :', e);
  }
}
