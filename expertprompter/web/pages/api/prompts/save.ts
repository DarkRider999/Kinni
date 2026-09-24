import { apiHandler, parseWith, requireDatabase, requireUser } from '@/lib/server/http';
import { prisma } from '@/lib/server/prisma';
import { SavePromptSchema } from '@/lib/server/schemas';

export const config = { api: { bodyParser: { sizeLimit: '200kb' } } };

// POST /api/prompts/save — explicit save (e.g. a guest result saved after signing in).
export default apiHandler({
  async POST(req, res) {
    const user = requireUser(req);
    requireDatabase();
    const body = parseWith(SavePromptSchema, req.body);
    const saved = await prisma.prompt.create({
      data: {
        userId: user.id,
        rawInput: body.rawInput,
        generatedPrompt: body.generatedPrompt,
        detectedCategory: body.detectedCategory,
        promptStyle: body.promptStyle,
        recommendedTools: body.recommendedTools,
        options: body.options ?? {},
        title: body.title ?? body.rawInput.slice(0, 80),
      },
    });
    res.status(201).json(saved);
  },
});
