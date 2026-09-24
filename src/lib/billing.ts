// Abonnements Stripe : paiement (Checkout), gestion (portail client) et synchronisation par webhook.
// Sans STRIPE_SECRET_KEY, la page d'abonnement propose de contacter l'équipe (changement d'offre manuel).
import Stripe from 'stripe';
import { prisma } from './db';
import { audit } from './audit';
import { publishBranchUpdate } from './queue';
import { isPlan } from './plans-shared';
import { billingUpdateFor, planForPrice, planPrices, shouldApply } from './billing-rules';

let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return (client = null);
  // Surchargeable pour les tests (serveur factice).
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  client = new Stripe(key, {
    maxNetworkRetries: 2,
    appInfo: { name: 'Daourak' },
    ...(base ? { protocol: base.protocol.replace(':', '') as 'http' | 'https', host: base.hostname, port: base.port } : {}),
  });
  return client;
}

/** Offres achetables en ligne (Stripe configuré et prix renseigné). */
export function purchasablePlans(): string[] {
  return stripe() ? Object.keys(planPrices()) : [];
}

/** Client Stripe de l'organisation, créé au premier paiement. */
export async function ensureCustomer(org: { id: string; name: string; stripeCustomerId: string | null }, email: string): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe()!.customers.create({ name: org.name, email, metadata: { orgId: org.id } });
  await prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/**
 * Relit la souscription chez Stripe (jamais l'objet du webhook, qui peut arriver dans le désordre)
 * et aligne l'offre de l'organisation.
 */
export async function syncSubscription(subscriptionId: string, orgHint?: string | null): Promise<void> {
  const sub = await stripe()!.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: sub.metadata.orgId || orgHint || '' }, { stripeCustomerId: customerId }] },
    select: { id: true, plan: true, stripeSubscriptionId: true, billingStatus: true },
  });
  if (!org || !shouldApply(org.stripeSubscriptionId, sub)) return;

  const item = sub.items.data[0];
  const metaPlan = sub.metadata.plan;
  const plan = planForPrice(item?.price.id) ?? (metaPlan && isPlan(metaPlan) ? metaPlan : null);
  const update = billingUpdateFor({
    id: sub.id,
    status: sub.status,
    plan,
    periodEnd: item?.current_period_end ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      ...(update.plan ? { plan: update.plan } : {}),
      billingStatus: update.billingStatus,
      planRenewsAt: update.planRenewsAt,
      cancelAtPeriodEnd: update.cancelAtPeriodEnd,
      stripeSubscriptionId: update.stripeSubscriptionId,
      stripeCustomerId: customerId,
    },
  });

  if (update.plan && update.plan !== org.plan) {
    await audit({ action: 'billing.plan', orgId: org.id, targetType: 'organization', targetId: org.id, metadata: { from: org.plan, to: update.plan, status: sub.status } });
    // L'offre change ce que voient les clients (réservation, marque…).
    const branches = await prisma.branch.findMany({ where: { orgId: org.id }, select: { id: true } });
    await Promise.all(branches.map((b) => publishBranchUpdate(b.id)));
  } else if (update.billingStatus !== org.billingStatus) {
    await audit({ action: 'billing.status', orgId: org.id, targetType: 'organization', targetId: org.id, metadata: { status: sub.status } });
  }
}
