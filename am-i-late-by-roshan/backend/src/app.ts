import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config';
import { checkDatabase } from './db/connection';
import { logger } from './logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { getBus } from './redis/pubsub';
import { assistantRouter } from './routes/assistant';
import { authRouter } from './routes/auth';
import { driverProfileRouter } from './routes/driver_profile';
import { notificationsRouter } from './routes/notifications';
import { parkingRouter } from './routes/parking';
import { placesRouter } from './routes/places';
import { privacyRouter } from './routes/privacy';
import { tollsRouter } from './routes/tolls';
import { trafficRouter } from './routes/traffic';
import { tripRouter } from './routes/trip';
import { fcmConfigured } from './services/push_notification_service';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));
  if (config.nodeEnv !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' },
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      }),
    );
  }
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.rateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req) => req.path === '/health',
      message: { error: { code: 'rate_limited', message: 'Too many requests' } },
    }),
  );

  app.get('/health', async (_req, res) => {
    const db = await checkDatabase();
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      database: db,
      eventBus: getBus().kind,
      mapProvider: config.mapProvider,
      aiServiceUrl: config.aiServiceUrl,
      push: fcmConfigured() ? 'fcm' : 'in-app',
      assistant: config.llmApiKey ? 'llm' : 'rules',
    });
  });

  app.use('/auth', authRouter);
  app.use('/trips', tripRouter);
  app.use('/traffic', trafficRouter);
  app.use('/tolls', tollsRouter);
  app.use('/parking', parkingRouter);
  app.use('/places', placesRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/driver-profile', driverProfileRouter);
  app.use('/assistant', assistantRouter);
  app.use('/privacy', privacyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
