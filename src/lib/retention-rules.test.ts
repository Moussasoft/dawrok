import { describe, expect, it } from 'vitest';
import { auditCutoff, isRetentionChoice, retentionCutoff, RETENTION_CHOICES, DEFAULT_RETENTION_DAYS } from './retention-rules';

const now = new Date('2026-09-24T12:00:00Z');

describe('règles de conservation', () => {
  it('propose des durées fixes, dont la valeur par défaut', () => {
    expect(RETENTION_CHOICES).toContain(DEFAULT_RETENTION_DAYS);
    expect(isRetentionChoice(180)).toBe(true);
    expect(isRetentionChoice(10)).toBe(false);
  });

  it('calcule la limite de conservation', () => {
    expect(retentionCutoff(now, 90).toISOString()).toBe('2026-06-26T12:00:00.000Z');
  });

  it('garde les journaux d’audit au moins un an', () => {
    expect(auditCutoff(now, 90).toISOString()).toBe(retentionCutoff(now, 365).toISOString());
    expect(auditCutoff(now, 730).toISOString()).toBe(retentionCutoff(now, 730).toISOString());
  });
});
