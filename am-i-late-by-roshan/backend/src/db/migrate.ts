/**
 * Applies database/migrations/*.sql in numeric order, once each, tracking what
 * ran in schema_migrations. Safe to run on every boot.
 *   npm run migrate            (dev, via tsx)
 *   npm run migrate:prod       (compiled)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pool } from './connection';
import { logger } from '../logger';

function migrationsDir(): string {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.resolve(__dirname, '../../../database/migrations'),
    path.resolve(__dirname, '../../database/migrations'),
    path.resolve(process.cwd(), '../database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Migrations directory not found (tried: ${candidates.join(', ')})`);
  return found;
}

export async function runMigrations(): Promise<string[]> {
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const client = await pool.connect();
  const applied: string[] = [];
  try {
    // Serialise concurrent boots (e.g. several containers starting together).
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        logger.info({ migration: file }, 'Applied migration');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => undefined);
    client.release();
  }
  return applied;
}

if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length ? `Applied ${applied.length} migration(s): ${applied.join(', ')}` : 'Database is up to date.');
      return pool.end();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
