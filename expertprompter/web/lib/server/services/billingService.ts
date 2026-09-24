// Stripe subscription sync. Webhooks only tell us *that* something changed;
// we re-read the subscription from Stripe each time, so out-of-order or
// repeated events always end in the latest state.

import type Stripe from 'stripe';
import { prisma } from '../prisma';
import { stripe } from '../stripe';

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Newer API versions report the period on each subscription item.
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const seconds = itemEnd ?? legacyEnd;
  return seconds ? new Date(seconds * 1000) : null;
}

export async function syncSubscription(subscriptionId: string, userIdHint?: string | null) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = userIdHint ?? sub.metadata?.userId ?? null;

  const data = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    currentPeriodEnd: periodEnd(sub),
  };

  if (userId) {
    await prisma.user.update({ where: { id: userId }, data });
  } else {
    await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data });
  }
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        await syncSubscription(subId, session.client_reference_id);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub.id);
      break;
    }
    default:
      // Other events are acknowledged and ignored.
      break;
  }
}
