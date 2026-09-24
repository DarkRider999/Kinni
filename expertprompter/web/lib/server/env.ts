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

/** Free generations per account before Premium is required. */
export const FREE_RUN_LIMIT = 5;

/** Comma-separated owner emails with unlimited access (only once the email is verified). */
export function masterEmails(): string[] {
  return (process.env.MASTER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Public base URL, used for OAuth redirect URIs and Stripe return URLs. */
export function appUrl(req?: { headers: Record<string, string | string[] | undefined> }): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const header = (name: string) => {
    const v = req?.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const host = header('x-forwarded-host') ?? header('host') ?? 'localhost:3000';
  const proto = header('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Premium price in cents; used when STRIPE_PRICE_ID is not set. */
export const PREMIUM_PRICE_CENTS = 1000;
