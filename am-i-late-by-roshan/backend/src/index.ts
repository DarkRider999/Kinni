import { createApp } from './app';
import { config } from './config';
import { pool } from './db/connection';
import { runMigrations } from './db/migrate';
import { logger } from './logger';
import { CHANNELS, getBus } from './redis/pubsub';
import { startNotificationScheduler } from './services/notification_scheduler';

async function main() {
  if (process.env.MIGRATE_ON_START !== 'false') {
    try {
      const applied = await runMigrations();
      if (applied.length) logger.info({ applied }, 'Migrations applied on start');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Migrations failed; is Postgres (with PostGIS) running?');
      throw err;
    }
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, mapProvider: config.mapProvider }, 'Am I Late? backend listening');
  });

  // Redis subscriber: traffic updates from any instance / reporter.
  let updates = 0;
  const unsubscribe = getBus().subscribe(CHANNELS.trafficUpdates, () => {
    updates++;
  });
  const statsTimer = setInterval(() => {
    if (updates) logger.info({ updates }, 'Traffic updates received in the last 5 minutes');
    updates = 0;
  }, 5 * 60_000);

  const cronTask = startNotificationScheduler();
  if (cronTask) logger.info('Smart Commute Early-Warning job scheduled (every 5 minutes)');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    cronTask?.stop();
    clearInterval(statsTimer);
    unsubscribe();
    server.close();
    await getBus().close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
