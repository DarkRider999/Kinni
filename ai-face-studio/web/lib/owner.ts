/**
 * Client-side demo gate only. Next.js inlines NEXT_PUBLIC_* at build time, so this value is
 * readable by anyone who opens devtools — it cannot be a real secret. The real check
 * (OWNER_EMAIL / OWNER_ACCESS_KEY, SPEC §15.1) must happen server-side, on a verified sign-in,
 * never by comparing a string the client sent itself.
 */
const DEMO_OWNER_EMAIL = (process.env.NEXT_PUBLIC_OWNER_EMAIL || '').trim().toLowerCase();

export function isDemoOwnerEmail(email: string): boolean {
  if (!DEMO_OWNER_EMAIL) return false;
  return email.trim().toLowerCase() === DEMO_OWNER_EMAIL;
}

export function demoOwnerConfigured(): boolean {
  return DEMO_OWNER_EMAIL.length > 0;
}
