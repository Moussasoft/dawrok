import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { stripe } from '@/lib/billing';
import { localizedUrl } from '@/lib/urls';
import { routing } from '@/i18n/routing';

const schema = z.object({ locale: z.enum(routing.locales).default(routing.defaultLocale) });

// Portail client Stripe (propriétaire) : moyen de paiement, factures, changement d'offre, résiliation.
export const POST = route(async (req) => {
  const auth = await requireOrgRole('owner');
  if (auth.impersonating) throw new ApiError(403, 'stop_impersonation_first');
  const { locale } = await parseBody(req, schema);
  const s = stripe();
  if (!s) throw new ApiError(503, 'billing_not_configured');
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: auth.orgId }, select: { stripeCustomerId: true } });
  if (!org.stripeCustomerId) throw new ApiError(404, 'no_billing_account');
  const session = await s.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: localizedUrl('/dashboard/billing', locale),
  });
  return NextResponse.json({ url: session.url });
});
