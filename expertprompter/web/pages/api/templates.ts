import { apiHandler, optionalUser } from '@/lib/server/http';
import { hasDatabase } from '@/lib/server/env';
import { prisma } from '@/lib/server/prisma';
import { TEMPLATES } from '@/lib/server/services/promptTemplates';

// GET /api/templates — DB templates (system + the user's own), falling back to the built-in catalog.
export default apiHandler({
  async GET(req, res) {
    if (hasDatabase()) {
      try {
        const user = optionalUser(req);
        const rows = await prisma.template.findMany({
          where: { OR: [{ createdBy: 'SYSTEM' }, ...(user ? [{ ownerId: user.id }] : [])] },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
        if (rows.length) return res.json(rows);
      } catch {
        // Database not reachable: serve the in-code catalog instead.
      }
    }
    res.json(
      TEMPLATES.map((t) => ({
        key: t.key, name: t.name, category: t.category, createdBy: 'SYSTEM',
        baseStructure: { sections: t.sections.map((s) => s.detail), defaultFormat: t.defaultFormat, qualityChecks: t.qualityChecks },
      })),
    );
  },
});
