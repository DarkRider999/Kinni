import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { api } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // behind Render/Vercel/NGINX proxies
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin/non-browser requests (no Origin header) and configured origins.
        // Unknown origins get no CORS headers, so the browser blocks the response.
        cb(null, !origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin));
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'expertprompter-api', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  });

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
