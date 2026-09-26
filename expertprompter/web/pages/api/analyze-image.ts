import { apiHandler, optionalUser, parseWith } from '@/lib/server/http';
import { hasDatabase } from '@/lib/server/env';
import { HttpError, paymentRequired, tooManyRequests, unauthorized } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';
import { rateLimit } from '@/lib/server/rateLimit';
import { entitlementFor } from '@/lib/server/services/entitlementService';
import { SUPPORTED_MEDIA_TYPES, describeImage } from '@/lib/server/vision';
import { z } from 'zod';

// A 1024px JPEG is ~150-300 KB of base64; allow headroom for PNGs.
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const MAX_BASE64_CHARS = 5_000_000;

const AnalyzeSchema = z.object({
  image: z.string().min(100).max(MAX_BASE64_CHARS).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Image must be base64 without a data: prefix'),
  mediaType: z.enum(SUPPORTED_MEDIA_TYPES),
});

// POST /api/analyze-image  { image: <base64>, mediaType } -> { description }
// Each call costs an API request, so it needs a signed-in account that can
// still generate (free runs left, Premium or Master). It does not use a run.
export default apiHandler(
  {
    async POST(req, res) {
      const auth = optionalUser(req);
      if (hasDatabase()) {
        if (!auth) throw new HttpError(401, 'Sign in to describe photos.', { code: 'AUTH_REQUIRED' });
        const user = await prisma.user.findUnique({ where: { id: auth.id } });
        if (!user) throw unauthorized('Account not found');
        const entitlement = entitlementFor(user);
        if (entitlement.plan === 'FREE' && entitlement.freeRunsRemaining === 0) {
          throw paymentRequired('Upgrade to Premium to describe more photos.', { code: 'PAYWALL' });
        }
        // Per account, on top of the per-IP limit below.
        if (!rateLimit(`analyze-user:${auth.id}`, 15, 60_000)) throw tooManyRequests();
      }

      const { image, mediaType } = parseWith(AnalyzeSchema, req.body);
      const description = await describeImage(image, mediaType);
      res.json({ description });
    },
  },
  { rateLimitPerMinute: 20 },
);
