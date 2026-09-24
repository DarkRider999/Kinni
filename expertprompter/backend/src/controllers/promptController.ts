import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ListQuerySchema, type SavePromptBody } from '../lib/schemas';
import { badRequest, notFound } from '../lib/httpError';
import { z } from 'zod';

// GET /api/prompts?limit=20&cursor=<id>&category=CODING&q=text
export async function listPrompts(req: Request, res: Response) {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Invalid query', z.flattenError(parsed.error).fieldErrors);
  const { limit, cursor, category, q } = parsed.data;

  const items = await prisma.prompt.findMany({
    where: {
      userId: req.user!.id,
      ...(category ? { detectedCategory: category } : {}),
      ...(q ? { OR: [{ rawInput: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // one extra to know whether there is a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  res.json({ items: page, nextCursor: hasMore ? page[page.length - 1].id : null });
}

// POST /api/prompts/save — explicit save (e.g. after editing or as a guest who then logged in).
export async function savePrompt(req: Request, res: Response) {
  const body = req.body as SavePromptBody;
  const saved = await prisma.prompt.create({
    data: {
      userId: req.user!.id,
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
}

// GET /api/prompts/:id
export async function getPrompt(req: Request, res: Response) {
  const prompt = await prisma.prompt.findFirst({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!prompt) throw notFound('Prompt not found');
  res.json(prompt);
}

// PATCH /api/prompts/:id/favorite
export async function toggleFavorite(req: Request, res: Response) {
  const prompt = await prisma.prompt.findFirst({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!prompt) throw notFound('Prompt not found');
  const updated = await prisma.prompt.update({ where: { id: prompt.id }, data: { isFavorite: !prompt.isFavorite } });
  res.json(updated);
}

// DELETE /api/prompts/:id — scoped to the owner so users cannot delete others' prompts.
export async function deletePrompt(req: Request, res: Response) {
  const { count } = await prisma.prompt.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (count === 0) throw notFound('Prompt not found');
  res.status(204).end();
}
