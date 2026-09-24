import { apiHandler, requireUser } from '@/lib/server/http';
import { hasDatabase } from '@/lib/server/env';
import { unauthorized } from '@/lib/server/httpError';
import { prisma } from '@/lib/server/prisma';
import { entitlementFor } from '@/lib/server/services/entitlementService';

// GET /api/auth/me — the signed-in user and their plan / remaining free runs.
export default apiHandler({
  async GET(req, res) {
    const auth = requireUser(req);
    if (!hasDatabase()) return res.json({ user: auth, entitlement: null });
    const user = await prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw unauthorized('Account not found');
    res.json({
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
      entitlement: entitlementFor(user),
    });
  },
});
