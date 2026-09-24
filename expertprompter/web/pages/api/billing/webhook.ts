import type { NextApiRequest } from 'next';
import type Stripe from 'stripe';
import { apiHandler } from '@/lib/server/http';
import { badRequest, serviceUnavailable } from '@/lib/server/httpError';
import { stripe } from '@/lib/server/stripe';
import { handleStripeEvent } from '@/lib/server/services/billingService';

// Stripe signs the exact bytes it sends, so the raw body must be kept.
export const config = { api: { bodyParser: false } };

async function rawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// POST /api/billing/webhook — register this URL in Stripe → Developers → Webhooks.
export default apiHandler({
  async POST(req, res) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw serviceUnavailable('Stripe webhook is not configured');
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') throw badRequest('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(await rawBody(req), signature, secret);
    } catch {
      throw badRequest('Invalid Stripe signature');
    }

    await handleStripeEvent(event);
    res.json({ received: true });
  },
});
