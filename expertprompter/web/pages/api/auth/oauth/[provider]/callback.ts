import type { NextApiResponse } from 'next';
import { apiHandler, param } from '@/lib/server/http';
import { appUrl, hasDatabase } from '@/lib/server/env';
import { HttpError } from '@/lib/server/httpError';
import { STATE_COOKIE, readCookie, setCookie } from '@/lib/server/cookies';
import { completeSignIn, isProviderId } from '@/lib/server/oauth';
import { signInWithProvider } from '@/lib/server/services/authService';

// The session token travels in the URL fragment, which browsers never send to
// servers, so it stays out of access logs and Referer headers.
function finish(res: NextApiResponse, base: string, fragment: string) {
  res.redirect(302, `${base}/#${fragment}`);
}

// GET /api/auth/oauth/:provider/callback?code=...&state=...
export default apiHandler(
  {
    async GET(req, res) {
      const base = appUrl(req);
      const provider = param(req, 'provider');
      const expected = readCookie(req, STATE_COOKIE);
      setCookie(req, res, STATE_COOKIE, '', { maxAge: 0, path: '/api/auth/oauth' });

      const fail = (message: string) => finish(res, base, `auth_error=${encodeURIComponent(message)}`);

      if (!hasDatabase() || !isProviderId(provider)) return fail('Sign-in is not available.');
      if (typeof req.query.error === 'string') return fail('Sign-in was cancelled.');

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      if (!code || !state || expected !== `${provider}:${state}`) {
        return fail('Your sign-in session expired. Please try again.');
      }

      try {
        const profile = await completeSignIn(provider, base, code);
        const session = await signInWithProvider(provider, profile);
        finish(res, base, `auth=${encodeURIComponent(session.token)}`);
      } catch (err) {
        console.error(`OAuth ${provider} callback failed:`, err);
        fail(err instanceof HttpError ? err.message : 'Sign-in failed. Please try again.');
      }
    },
  },
  { rateLimitPerMinute: 20 },
);
