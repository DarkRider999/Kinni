import Stripe from 'stripe';
import { serviceUnavailable } from './httpError';

let client: Stripe | undefined;

/** Lazily created so builds and guest-only deployments do not need Stripe keys. */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw serviceUnavailable('Payments are not set up yet. Please check back soon.');
  return (client ??= new Stripe(key));
}
