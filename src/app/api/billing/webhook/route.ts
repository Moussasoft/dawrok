import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { ApiError, route } from '@/lib/api';
import { stripe, syncSubscription } from '@/lib/billing';

export const dynamic = 'force-dynamic';

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

// Webhook Stripe : signature vérifiée sur le corps brut, puis synchronisation idempotente de l'offre.
export const POST = route(async (req) => {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) throw new ApiError(404, 'not_found');

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(payload, req.headers.get('stripe-signature') ?? '', secret);
  } catch {
    throw new ApiError(400, 'invalid_signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription' && typeof session.subscription === 'string') {
      await syncSubscription(session.subscription, session.client_reference_id);
    }
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    await syncSubscription((event.data.object as Stripe.Subscription).id);
  }
  return NextResponse.json({ received: true });
});
