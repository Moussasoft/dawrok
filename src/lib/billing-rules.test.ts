import { describe, expect, it } from 'vitest';
import { billingUpdateFor, planForPrice, planPrices, shouldApply } from './billing-rules';

const env = { STRIPE_PRICE_STARTER: 'price_s', STRIPE_PRICE_PRO: 'price_p' };

describe('prix Stripe des offres', () => {
  it('lit les prix configurés, sans l’offre gratuite', () => {
    expect(planPrices(env)).toEqual({ starter: 'price_s', pro: 'price_p' });
    expect(planPrices({ STRIPE_PRICE_FREE: 'x' })).toEqual({});
  });

  it('retrouve l’offre d’un prix', () => {
    expect(planForPrice('price_p', env)).toBe('pro');
    expect(planForPrice('price_inconnu', env)).toBeNull();
    expect(planForPrice(null, env)).toBeNull();
  });
});

describe('état d’une souscription', () => {
  const base = { id: 'sub_1', plan: 'pro' as const, periodEnd: 1_790_000_000, cancelAtPeriodEnd: false };

  it('active / essai / impayé en relance : offre accordée', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      const u = billingUpdateFor({ ...base, status });
      expect(u.plan).toBe('pro');
      expect(u.billingStatus).toBe(status);
      expect(u.planRenewsAt?.getTime()).toBe(1_790_000_000_000);
      expect(u.stripeSubscriptionId).toBe('sub_1');
    }
  });

  it('terminée : retour à l’offre gratuite', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired']) {
      expect(billingUpdateFor({ ...base, status })).toEqual({
        plan: 'free',
        billingStatus: status,
        planRenewsAt: null,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
      });
    }
  });

  it('premier paiement en attente : offre inchangée', () => {
    expect(billingUpdateFor({ ...base, status: 'incomplete' }).plan).toBeNull();
  });

  it('résiliation programmée conservée jusqu’à la fin de la période', () => {
    expect(billingUpdateFor({ ...base, status: 'active', cancelAtPeriodEnd: true }).cancelAtPeriodEnd).toBe(true);
  });
});

describe('application à l’organisation', () => {
  it('applique la souscription courante, quel que soit son statut', () => {
    expect(shouldApply('sub_1', { id: 'sub_1', status: 'canceled' })).toBe(true);
  });

  it('une ancienne souscription terminée ne rétrograde pas l’organisation', () => {
    expect(shouldApply('sub_2', { id: 'sub_1', status: 'canceled' })).toBe(false);
    expect(shouldApply(null, { id: 'sub_1', status: 'canceled' })).toBe(false);
  });

  it('une nouvelle souscription active remplace l’ancienne', () => {
    expect(shouldApply('sub_1', { id: 'sub_2', status: 'active' })).toBe(true);
    expect(shouldApply(null, { id: 'sub_2', status: 'incomplete' })).toBe(true);
  });
});
