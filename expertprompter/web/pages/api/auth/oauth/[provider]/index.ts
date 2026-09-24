import { randomBytes } from 'node:crypto';
import { apiHandler, param, requireDatabase } from '@/lib/server/http';
import { appUrl } from '@/lib/server/env';
import { notFound } from '@/lib/server/httpError';
import { STATE_COOKIE, setCookie } from '@/lib/server/cookies';
import { authorizationUrl, isProviderId } from '@/lib/server/oauth';

// GET /api/auth/oauth/:provider — redirects to the provider's consent screen.
export default apiHandler(
  {
    GET(req, res) {
      requireDatabase();
      const provider = param(req, 'provider');
      if (!isProviderId(provider)) throw notFound('Unknown sign-in provider');

      // Random state ties the callback to this browser (CSRF protection).
      const state = randomBytes(24).toString('base64url');
      const url = authorizationUrl(provider, appUrl(req), state);
      if (!url) throw notFound('This sign-in provider is not enabled');

      setCookie(req, res, STATE_COOKIE, `${provider}:${state}`, { maxAge: 600, path: '/api/auth/oauth' });
      res.redirect(302, url);
    },
  },
  { rateLimitPerMinute: 20 },
);
