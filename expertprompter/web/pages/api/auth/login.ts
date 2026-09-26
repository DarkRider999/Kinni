import { apiHandler, parseWith, requireDatabase } from '@/lib/server/http';
import { LoginSchema } from '@/lib/server/schemas';
import { login } from '@/lib/server/services/authService';

export default apiHandler(
  {
    async POST(req, res) {
      requireDatabase();
      const { email, password } = parseWith(LoginSchema, req.body);
      res.json(await login(email, password));
    },
  },
  { rateLimitPerMinute: 10 },
);
