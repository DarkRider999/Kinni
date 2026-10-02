import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db/connection';
import { runMigrations } from '../src/db/migrate';

export const app = createApp();

let migrated = false;
export async function resetDatabase(): Promise<void> {
  if (!migrated) {
    await runMigrations();
    migrated = true;
  }
  await pool.query('TRUNCATE users, events RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE traffic_snapshots');
}

let counter = 0;
export async function registerUser(): Promise<{ token: string; userId: string; email: string }> {
  const email = `driver${Date.now()}${counter++}@example.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-9', displayName: 'Test Driver' }).expect(201);
  return { token: res.body.token, userId: res.body.user.id, email };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Integration tests need Postgres + PostGIS; skip gracefully when it isn't reachable. */
export async function databaseAvailable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
