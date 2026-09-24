// Durées de conservation (loi 09-08) : règles pures, partagées entre l'API, la purge et les réglages.
// Ce fichier ne doit importer aucun module serveur (il est aussi utilisé côté client).

export const RETENTION_CHOICES = [90, 180, 365, 730] as const;
export type RetentionChoice = (typeof RETENTION_CHOICES)[number];
export const DEFAULT_RETENTION_DAYS: RetentionChoice = 365;
/** Les journaux d'audit servent à la sécurité : jamais conservés moins d'un an. */
export const MIN_AUDIT_RETENTION_DAYS = 365;
/** Prénom affiché à la place de celui d'un client anonymisé. */
export const ANONYMIZED_NAME = '—';

const DAY_MS = 86_400_000;

export function isRetentionChoice(value: number): value is RetentionChoice {
  return (RETENTION_CHOICES as readonly number[]).includes(value);
}

/** Limite de conservation : tout ce qui est antérieur est purgé. */
export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - Math.max(1, days) * DAY_MS);
}

export function auditCutoff(now: Date, retentionDays: number): Date {
  return retentionCutoff(now, Math.max(retentionDays, MIN_AUDIT_RETENTION_DAYS));
}
