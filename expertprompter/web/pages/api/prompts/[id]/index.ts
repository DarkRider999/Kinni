import { apiHandler, param, requireDatabase, requireUser } from '@/lib/server/http';
import { notFound } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';

// GET / DELETE /api/prompts/:id — always scoped to the owner.
export default apiHandler({
  async GET(req, res) {
    const user = requireUser(req);
    requireDatabase();
    const prompt = await prisma.prompt.findFirst({ where: { id: param(req, 'id'), userId: user.id } });
    if (!prompt) throw notFound('Prompt not found');
    res.json(prompt);
  },
  async DELETE(req, res) {
    const user = requireUser(req);
    requireDatabase();
    const { count } = await prisma.prompt.deleteMany({ where: { id: param(req, 'id'), userId: user.id } });
    if (count === 0) throw notFound('Prompt not found');
    res.status(204).end();
  },
});
