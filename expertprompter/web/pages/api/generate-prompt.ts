import { apiHandler, optionalUser, parseWith } from '@/lib/server/http';
import { hasDatabase } from '@/lib/server/env';
import { prisma } from '@/lib/server/prisma';
import { GenerateSchema } from '@/lib/server/schemas';
import { runGeneration } from '@/lib/server/services/expertPrompterService';

export const config = { api: { bodyParser: { sizeLimit: '200kb' } } };

// POST /api/generate-prompt — open to guests; auto-saves for signed-in users.
export default apiHandler(
  {
    async POST(req, res) {
      const body = parseWith(GenerateSchema, req.body);
      const user = optionalUser(req);
      const result = runGeneration({
        rawInput: body.rawInput,
        promptStyle: body.promptStyle,
        options: body.options,
        variation: body.variation,
        categoryOverride: body.category,
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
      res.json({ ...payload, savedPromptId });
    },
  },
  { rateLimitPerMinute: 60 },
);
