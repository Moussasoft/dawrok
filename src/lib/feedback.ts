// Avis client après passage : règles pures, partagées entre l'API, la page ticket et les analytics.
// Ce fichier ne doit importer aucun module serveur (il est aussi utilisé côté client).

/** Délai pendant lequel le client peut noter son passage. */
export const FEEDBACK_WINDOW_DAYS = 7;
export const FEEDBACK_COMMENT_MAX = 500;
export const RATINGS = [1, 2, 3, 4, 5] as const;

/** Un avis n'est proposé qu'après un passage terminé, et seulement quelques jours. */
export function isFeedbackOpen(ticket: { status: string; completedAt: Date | null }, now = Date.now()): boolean {
  if (ticket.status !== 'done' || !ticket.completedAt) return false;
  return now - ticket.completedAt.getTime() <= FEEDBACK_WINDOW_DAYS * 86_400_000;
}

export type RatingSummary = {
  count: number;
  /** Moyenne arrondie au dixième (0 sans avis). */
  average: number;
  /** Nombre d'avis par note : index 0 = 1 étoile … index 4 = 5 étoiles. */
  distribution: [number, number, number, number, number];
};

export function summarizeRatings(ratings: number[]): RatingSummary {
  const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
  let sum = 0;
  let count = 0;
  for (const r of ratings) {
    if (!Number.isInteger(r) || r < 1 || r > 5) continue;
    distribution[r - 1]++;
    sum += r;
    count++;
  }
  return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, distribution };
}
