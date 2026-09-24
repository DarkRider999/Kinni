import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { runGeneration } from '../services/expertPrompterService';
import type { GenerateBody } from '../lib/schemas';

// POST /api/generate-prompt — open to guests; auto-saves for logged-in users.
export async function generatePromptHandler(req: Request, res: Response) {
  const body = req.body as GenerateBody;
  const result = runGeneration({
    rawInput: body.rawInput,
    promptStyle: body.promptStyle,
    options: body.options,
    variation: body.variation,
    categoryOverride: body.category,
  });

  let savedPromptId: string | undefined;
  if (req.user && body.save !== false) {
    const saved = await prisma.prompt.create({
      data: {
        userId: req.user.id,
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
}
