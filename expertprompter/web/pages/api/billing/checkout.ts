import { apiHandler, requireDatabase, requireUser } from '@/lib/server/http';
import { PREMIUM_PRICE_CENTS, appUrl } from '@/lib/server/env';
import { unauthorized } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';
import { stripe } from '@/lib/server/stripe';
import { planFor } from '@/lib/server/services/entitlementService';

// POST /api/billing/checkout — returns a Stripe Checkout URL for Premium ($10/month).
export default apiHandler(
  {
    async POST(req, res) {
      const auth = requireUser(req);
      requireDatabase();
      const user = await prisma.user.findUnique({ where: { id: auth.id } });
      if (!user) throw unauthorized('Account not found');

      const base = appUrl(req);
      const client = stripe();

      // Already subscribed (or master): send them to manage billing instead.
      if (planFor(user) !== 'FREE' && user.stripeCustomerId) {
        const portal = await client.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: base });
        return res.json({ url: portal.url });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await client.customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId: user.id } });
        customerId = customer.id;
        await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
      }

      // STRIPE_PRICE_ID wins when set; otherwise the $10/month price is defined inline.
      const lineItem = process.env.STRIPE_PRICE_ID
        ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: PREMIUM_PRICE_CENTS,
              recurring: { interval: 'month' as const },
              product_data: { name: 'ExpertPrompter Premium', description: 'Unlimited expert prompts' },
            },
          };

      const session = await client.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: user.id,
        line_items: [lineItem],
        subscription_data: { metadata: { userId: user.id } },
        allow_promotion_codes: true,
        success_url: `${base}/?billing=success`,
        cancel_url: `${base}/?billing=cancelled`,
      });
      res.json({ url: session.url });
    },
  },
  { rateLimitPerMinute: 10 },
);
