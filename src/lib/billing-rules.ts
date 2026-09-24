// Abonnements : règles pures (correspondance offre ↔ prix Stripe, état d'une souscription).
import { PLANS, type Plan } from './plans-shared';

export const PAID_PLANS = PLANS.filter((p) => p !== 'free') as Exclude<Plan, 'free'>[];

/** Prix Stripe de chaque offre payante (STRIPE_PRICE_STARTER, _PRO, _BUSINESS). */
export function planPrices(env: Record<string, string | undefined> = process.env): Partial<Record<Plan, string>> {
  const out: Partial<Record<Plan, string>> = {};
  for (const plan of PAID_PLANS) {
    const price = env[`STRIPE_PRICE_${plan.toUpperCase()}`];
    if (price) out[plan] = price;
  }
  return out;
}

export function planForPrice(priceId: string | null | undefined, env?: Record<string, string | undefined>): Plan | null {
  if (!priceId) return null;
  const entry = Object.entries(planPrices(env)).find(([, id]) => id === priceId);
  return (entry?.[0] as Plan | undefined) ?? null;
}

/** Souscription qui donne accès à l'offre payée (période d'essai et impayé en cours de relance compris). */
export const ENTITLED_STATUSES = ['active', 'trialing', 'past_due'] as const;
const ENDED_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'paused'];

export type SubscriptionSnapshot = {
  id: string;
  status: string;
  plan: Plan | null;
  /** Fin de la période en cours (secondes Unix). */
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

export type OrgBillingUpdate = {
  /** null : ne pas toucher à l'offre (ex. premier paiement en attente). */
  plan: Plan | null;
  billingStatus: string;
  planRenewsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
};

export function billingUpdateFor(sub: SubscriptionSnapshot): OrgBillingUpdate {
  if ((ENTITLED_STATUSES as readonly string[]).includes(sub.status)) {
    return {
      plan: sub.plan,
      billingStatus: sub.status,
      planRenewsAt: sub.periodEnd ? new Date(sub.periodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      stripeSubscriptionId: sub.id,
    };
  }
  if (ENDED_STATUSES.includes(sub.status)) {
    return { plan: 'free', billingStatus: sub.status, planRenewsAt: null, cancelAtPeriodEnd: false, stripeSubscriptionId: null };
  }
  // « incomplete » : premier paiement pas encore confirmé (3-D Secure…).
  return { plan: null, billingStatus: sub.status, planRenewsAt: null, cancelAtPeriodEnd: false, stripeSubscriptionId: sub.id };
}

/**
 * Faut-il appliquer cette souscription à l'organisation ? Une ancienne souscription terminée ne doit
 * pas rétrograder une organisation qui en a une nouvelle (ou dont le superadmin a changé l'offre).
 */
export function shouldApply(current: string | null, sub: { id: string; status: string }): boolean {
  if (current === sub.id) return true;
  return sub.status === 'incomplete' || (ENTITLED_STATUSES as readonly string[]).includes(sub.status);
}
