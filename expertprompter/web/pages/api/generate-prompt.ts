import { apiHandler, optionalUser, parseWith } from '@/lib/server/http';
import { FREE_RUN_LIMIT, hasDatabase } from '@/lib/server/env';
import { HttpError, paymentRequired } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';
import { consumeRun, type Entitlement } from '@/lib/server/services/entitlementService';
import { GenerateSchema } from '@/lib/server/schemas';
import { runGeneration } from '@/lib/server/services/expertPrompterService';

// Attached file text can make requests larger than a typical JSON body.
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// POST /api/generate-prompt
// With a database (production): sign-in required, and each call uses one of the
// user's free runs unless they are Master or Premium. Without a database
// (local/preview), guests can generate freely.
export default apiHandler(
  {
    async POST(req, res) {
      const body = parseWith(GenerateSchema, req.body);
      const user = optionalUser(req);

      let entitlement: Entitlement | null = null;
      if (hasDatabase()) {
        if (!user) {
          throw new HttpError(401, `Sign in to get ${FREE_RUN_LIMIT} free prompts.`, { code: 'AUTH_REQUIRED' });
        }
        entitlement = await consumeRun(user.id);
        if (!entitlement) {
          throw paymentRequired(`You've used all ${FREE_RUN_LIMIT} free prompts. Upgrade to Premium for unlimited prompts.`, { code: 'PAYWALL' });
        }
      }

      const result = runGeneration({
        rawInput: body.rawInput,
        promptStyle: body.promptStyle,
        options: body.options,
        variation: body.variation,
        categoryOverride: body.category,
        attachments: body.attachments,
      });

      let savedPromptId: string | undefined;
      if (user && body.save !== false && hasDatabase()) {
        const saved = await prisma.prompt.create({
          data: {
            userId: user.id,
            rawInput: body.rawInput,
            detectedCategory: result.detectedCategory,
            promptStyle: result.promptStyle,
            options: body.options ?? {},
            generatedPrompt: result.generatedPrompt,
            recommendedTools: result.recommendedTools,
            title: result.title,
          },
          select: { id: true },
        });
        savedPromptId = saved.id;
      }

      const { templateKey: _templateKey, ...payload } = result;
      res.json({ ...payload, savedPromptId, entitlement });
    },
  },
  { rateLimitPerMinute: 60 },
);
