// Server-only configuration. Read lazily so `next build` does not need secrets.

const DEV_SECRET = 'dev-only-insecure-secret-change-me';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (at least 16 characters) in production');
  }
  return DEV_SECRET;
}

export const jwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

/** Accounts and history need a database; guest generation does not. */
export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
