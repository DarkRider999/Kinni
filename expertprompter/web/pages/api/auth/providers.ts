import { apiHandler } from '@/lib/server/http';
import { FREE_RUN_LIMIT, hasDatabase, stripeConfigured } from '@/lib/server/env';
import { enabledProviders } from '@/lib/server/oauth';
import { visionConfigured } from '@/lib/server/vision';

// GET /api/auth/providers — what the sign-in dialog and paywall should offer.
export default apiHandler({
  GET(_req, res) {
    res.json({
      accountsEnabled: hasDatabase(),
      providers: hasDatabase() ? enabledProviders() : [],
      billingEnabled: stripeConfigured(),
      visionEnabled: visionConfigured(),
      freeRunsLimit: FREE_RUN_LIMIT,
    });
  },
});
