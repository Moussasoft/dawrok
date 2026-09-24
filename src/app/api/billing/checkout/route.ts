import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { ensureCustomer, stripe } from '@/lib/billing';
import { ENTITLED_STATUSES, PAID_PLANS, planPrices } from '@/lib/billing-rules';
import { localizedUrl } from '@/lib/urls';
import { audit } from '@/lib/audit';
import { routing } from '@/i18n/routing';

const schema = z.object({
  plan: z.enum(PAID_PLANS as [string, ...string[]]),
  locale: z.enum(routing.locales).default(routing.defaultLocale),
});

// Souscription d'une offre payante (propriétaire) : redirection vers Stripe Checkout.
export const POST = route(async (req) => {
  const auth = await requireOrgRole('owner');
  if (auth.impersonating) throw new ApiError(403, 'stop_impersonation_first');
  const { plan, locale } = await parseBody(req, schema);
  const s = stripe();
  if (!s) throw new ApiError(503, 'billing_not_configured');
  const price = planPrices()[plan as keyof ReturnType<typeof planPrices>];
  if (!price) throw new ApiError(400, 'plan_not_purchasable');

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: auth.orgId },
    select: { id: true, name: true, stripeCustomerId: true, stripeSubscriptionId: true, billingStatus: true },
  });
  // Changer d'offre en cours d'abonnement se fait dans le portail (prorata géré par Stripe).
  if (org.stripeSubscriptionId && (ENTITLED_STATUSES as readonly string[]).includes(org.billingStatus ?? '')) {
    throw new ApiError(409, 'subscription_exists');
  }

  const customer = await ensureCustomer(org, auth.email);
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: org.id,
    metadata: { orgId: org.id, plan },
    subscription_data: { metadata: { orgId: org.id, plan } },
    allow_promotion_codes: true,
    locale: locale === 'ar' ? 'auto' : locale,
    success_url: localizedUrl('/dashboard/billing?status=success', locale),
    cancel_url: localizedUrl('/dashboard/billing?status=cancelled', locale),
  });
  await audit({ action: 'billing.checkout', actor: auth, targetType: 'organization', targetId: org.id, metadata: { plan } });
  if (!session.url) throw new ApiError(502, 'billing_unavailable');
  return NextResponse.json({ url: session.url });
});
