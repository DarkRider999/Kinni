import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { TEMPLATES } from '../services/promptTemplates';
import { TOOL_CATALOG } from '../services/aiRecommendationService';
import { CATEGORIES, CATEGORY_LABELS, PROMPT_STYLES } from '../types';

// GET /api/meta — option lists for the UI (no DB needed).
export function metaHandler(_req: Request, res: Response) {
  res.json({
    categories: CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
    styles: PROMPT_STYLES,
    tools: Object.values(TOOL_CATALOG),
  });
}

// GET /api/templates — DB templates (system + the user's own), falling back to the built-in catalog.
export async function templatesHandler(req: Request, res: Response) {
  try {
    const rows = await prisma.template.findMany({
      where: { OR: [{ createdBy: 'SYSTEM' }, ...(req.user ? [{ ownerId: req.user.id }] : [])] },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    if (rows.length) return res.json(rows);
  } catch {
    // Database not reachable: serve the in-code catalog instead.
  }
  res.json(
    TEMPLATES.map((t) => ({
      key: t.key, name: t.name, category: t.category, createdBy: 'SYSTEM',
      baseStructure: { sections: t.sections.map((s) => s.detail), defaultFormat: t.defaultFormat, qualityChecks: t.qualityChecks },
    })),
  );
}
