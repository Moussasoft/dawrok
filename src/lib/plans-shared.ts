// Offres : constantes pures, utilisables côté client comme côté serveur (sans Prisma).

export const PLANS = ['free', 'starter', 'pro', 'business'] as const;
export type Plan = (typeof PLANS)[number];

/** Devise d'affichage des prix des plans. */
export const CURRENCY = '€';

export const DEFAULT_BRAND_COLOR = '#6366F1';

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}
