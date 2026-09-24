import { apiHandler, requireDatabase, requireUser } from '@/lib/server/http';
import { appUrl } from '@/lib/server/env';
import { badRequest } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';
import { stripe } from '@/lib/server/stripe';

// POST /api/billing/portal — Stripe's hosted page to update card or cancel.
export default apiHandler(
  {
    async POST(req, res) {
      const auth = requireUser(req);
      requireDatabase();
      const user = await prisma.user.findUnique({ where: { id: auth.id } });
      if (!user?.stripeCustomerId) throw badRequest('No subscription found for this account');
      const portal = await stripe().billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: appUrl(req) });
      res.json({ url: portal.url });
    },
  },
  { rateLimitPerMinute: 10 },
);
