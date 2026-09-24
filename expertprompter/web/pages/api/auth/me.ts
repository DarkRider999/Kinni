import { apiHandler, requireUser } from '@/lib/server/http';

export default apiHandler({
  GET(req, res) {
    res.json({ user: requireUser(req) });
  },
});
