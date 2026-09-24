import { apiHandler, parseWith, requireDatabase, requireUser } from '@/lib/server/http';
import { prisma } from '@/lib/server/prisma';
import { ListQuerySchema } from '@/lib/server/schemas';

// GET /api/prompts?limit=20&cursor=<id>&category=CODING&q=text
export default apiHandler({
  async GET(req, res) {
    const user = requireUser(req);
    requireDatabase();
    const { limit, cursor, category, q } = parseWith(ListQuerySchema, req.query, 'Invalid query');

    const items = await prisma.prompt.findMany({
      where: {
        userId: user.id,
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
  },
});
