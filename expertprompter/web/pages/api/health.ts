import { apiHandler } from '@/lib/server/http';
import { hasDatabase } from '@/lib/server/env';

export default apiHandler({
  GET(_req, res) {
    res.json({ status: 'ok', service: 'ananvi-promptmaster', database: hasDatabase() ? 'configured' : 'not-configured', timestamp: new Date().toISOString() });
  },
});
