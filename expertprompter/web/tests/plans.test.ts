import { afterEach, describe, expect, it } from 'vitest';
import { entitlementFor, planFor } from '../lib/server/services/entitlementService';
import { authorizationUrl, enabledProviders } from '../lib/server/oauth';

const base = { email: 'someone@example.com', emailVerified: null as Date | null, freeRunsUsed: 0, subscriptionStatus: null as string | null, currentPeriodEnd: null as Date | null };
const envBackup = { ...process.env };
afterEach(() => {
  process.env = { ...envBackup };
});

describe('plans', () => {
  it('is FREE by default with 5 runs', () => {
    expect(entitlementFor(base)).toMatchObject({ plan: 'FREE', freeRunsRemaining: 5, freeRunsLimit: 5 });
    expect(entitlementFor({ ...base, freeRunsUsed: 5 }).freeRunsRemaining).toBe(0);
  });

  it('grants MASTER only to a verified owner email', () => {
    process.env.MASTER_EMAILS = 'Owner@Example.com, other@example.com';
    const owner = { ...base, email: 'owner@example.com' };
    expect(planFor(owner)).toBe('FREE'); // not verified: could be an impostor who typed the email
    expect(planFor({ ...owner, emailVerified: new Date() })).toBe('MASTER');
    expect(entitlementFor({ ...owner, emailVerified: new Date(), freeRunsUsed: 99 }).freeRunsRemaining).toBeNull();
  });

  it('grants PREMIUM for active or trialing subscriptions that have not lapsed', () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(planFor({ ...base, subscriptionStatus: 'active', currentPeriodEnd: future })).toBe('PREMIUM');
    expect(planFor({ ...base, subscriptionStatus: 'trialing', currentPeriodEnd: future })).toBe('PREMIUM');
    expect(planFor({ ...base, subscriptionStatus: 'canceled', currentPeriodEnd: future })).toBe('FREE');
    expect(planFor({ ...base, subscriptionStatus: 'past_due', currentPeriodEnd: future })).toBe('FREE');
    expect(planFor({ ...base, subscriptionStatus: 'active', currentPeriodEnd: new Date(Date.now() - 1000) })).toBe('FREE');
  });
});

describe('oauth providers', () => {
  it('enables a provider only when both credentials are set', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.FACEBOOK_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_ID;
    expect(enabledProviders()).toEqual([]);
    process.env.GOOGLE_CLIENT_ID = 'gid';
    expect(enabledProviders()).toEqual([]);
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    expect(enabledProviders()).toEqual([{ id: 'google', label: 'Google' }]);
  });

  it('builds the authorization URL with state and the callback URI', () => {
    process.env.GITHUB_CLIENT_ID = 'ghid';
    process.env.GITHUB_CLIENT_SECRET = 'ghsecret';
    const url = new URL(authorizationUrl('github', 'https://app.example', 'st4te')!);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('ghid');
    expect(url.searchParams.get('state')).toBe('st4te');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/api/auth/oauth/github/callback');
    expect(url.searchParams.has('client_secret')).toBe(false);
  });
});
