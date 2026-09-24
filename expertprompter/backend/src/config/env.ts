import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

const parsed = EnvSchema.safeParse({
  ...process.env,
  // Tests and local runs without a .env still boot; production must set a real secret.
  JWT_SECRET: process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret-change-me'),
});

if (!parsed.success) {
  console.error('Invalid environment configuration:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
};
