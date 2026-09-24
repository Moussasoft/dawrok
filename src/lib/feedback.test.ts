import { describe, expect, it } from 'vitest';
import { FEEDBACK_WINDOW_DAYS, isFeedbackOpen, summarizeRatings } from './feedback';

const DAY = 86_400_000;

describe('isFeedbackOpen', () => {
  const now = Date.parse('2026-09-24T12:00:00Z');

  it('accepte un passage terminé récemment', () => {
    expect(isFeedbackOpen({ status: 'done', completedAt: new Date(now - DAY) }, now)).toBe(true);
  });

  it('refuse après la fenêtre', () => {
    const old = new Date(now - (FEEDBACK_WINDOW_DAYS * DAY + 1));
    expect(isFeedbackOpen({ status: 'done', completedAt: old }, now)).toBe(false);
  });

  it('refuse un ticket non terminé, annulé ou absent', () => {
    for (const status of ['waiting', 'called', 'in_progress', 'cancelled', 'no_show']) {
      expect(isFeedbackOpen({ status, completedAt: new Date(now) }, now)).toBe(false);
    }
    expect(isFeedbackOpen({ status: 'done', completedAt: null }, now)).toBe(false);
  });
});

describe('summarizeRatings', () => {
  it('calcule moyenne et répartition', () => {
    expect(summarizeRatings([5, 4, 4, 1])).toEqual({ count: 4, average: 3.5, distribution: [1, 0, 0, 2, 1] });
  });

  it('arrondit au dixième', () => {
    expect(summarizeRatings([5, 5, 4]).average).toBe(4.7);
  });

  it('ignore les valeurs invalides et gère l’absence d’avis', () => {
    expect(summarizeRatings([])).toEqual({ count: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
    expect(summarizeRatings([0, 6, 2.5, 3]).count).toBe(1);
  });
});
