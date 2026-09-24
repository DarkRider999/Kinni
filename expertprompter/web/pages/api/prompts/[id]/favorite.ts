import { apiHandler, param, requireDatabase, requireUser } from '@/lib/server/http';
import { notFound } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';

// PATCH /api/prompts/:id/favorite — toggles the favourite flag.
export default apiHandler({
  async PATCH(req, res) {
    const user = requireUser(req);
    requireDatabase();
    const prompt = await prisma.prompt.findFirst({ where: { id: param(req, 'id'), userId: user.id } });
    if (!prompt) throw notFound('Prompt not found');
    const updated = await prisma.prompt.update({ where: { id: prompt.id }, data: { isFavorite: !prompt.isFavorite } });
    res.json(updated);
  },
});
