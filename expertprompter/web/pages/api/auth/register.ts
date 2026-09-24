import { apiHandler, parseWith, requireDatabase } from '@/lib/server/http';
import { CredentialsSchema } from '@/lib/server/schemas';
import { register } from '@/lib/server/services/authService';

export default apiHandler(
  {
    async POST(req, res) {
      requireDatabase();
      const { email, password } = parseWith(CredentialsSchema, req.body);
      res.status(201).json(await register(email, password));
    },
  },
  { rateLimitPerMinute: 10 },
);
