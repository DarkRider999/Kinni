// Sign in with Google, Facebook and GitHub (OAuth 2.0 authorization-code flow).
// A provider is enabled when both of its env vars are set, e.g.
// GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. The callback URL to register with
// each provider is  <APP_URL>/api/auth/oauth/<provider>/callback

export type ProviderId = 'google' | 'facebook' | 'github';

export interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  /** True only when the provider vouches that the user owns the email. */
  emailVerified: boolean;
  name: string | null;
  image: string | null;
}

interface ProviderDef {
  id: ProviderId;
  label: string;
  envPrefix: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  fetchProfile: (accessToken: string) => Promise<OAuthProfile>;
}

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`OAuth request to ${new URL(url).host} failed (${res.status})`);
  return (await res.json()) as T;
}

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  google: {
    id: 'google',
    label: 'Google',
    envPrefix: 'GOOGLE',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    async fetchProfile(token) {
      const p = await getJson<{ sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        bearer(token),
      );
      return { providerAccountId: p.sub, email: p.email ?? null, emailVerified: p.email_verified === true, name: p.name ?? null, image: p.picture ?? null };
    },
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    envPrefix: 'FACEBOOK',
    // Unversioned endpoints use the Facebook app's default Graph API version.
    authorizeUrl: 'https://www.facebook.com/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/oauth/access_token',
    scope: 'email,public_profile',
    async fetchProfile(token) {
      const p = await getJson<{ id: string; email?: string; name?: string; picture?: { data?: { url?: string } } }>(
        'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
        bearer(token),
      );
      // Facebook only returns an email the user has confirmed with Facebook.
      return { providerAccountId: p.id, email: p.email ?? null, emailVerified: Boolean(p.email), name: p.name ?? null, image: p.picture?.data?.url ?? null };
    },
  },
  github: {
    id: 'github',
    label: 'GitHub',
    envPrefix: 'GITHUB',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    async fetchProfile(token) {
      const init = { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ExpertPrompter' } };
      const user = await getJson<{ id: number; name?: string; login: string; avatar_url?: string }>('https://api.github.com/user', init);
      const emails = await getJson<Array<{ email: string; primary: boolean; verified: boolean }>>('https://api.github.com/user/emails', init);
      const best = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified) ?? null;
      return { providerAccountId: String(user.id), email: best?.email ?? null, emailVerified: Boolean(best), name: user.name ?? user.login, image: user.avatar_url ?? null };
    },
  },
};

export function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS;
}

function credentials(provider: ProviderDef) {
  const clientId = process.env[`${provider.envPrefix}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.envPrefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function enabledProviders(): Array<{ id: ProviderId; label: string }> {
  return Object.values(PROVIDERS)
    .filter((p) => credentials(p))
    .map((p) => ({ id: p.id, label: p.label }));
}

export function redirectUri(base: string, provider: ProviderId) {
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export function authorizationUrl(providerId: ProviderId, base: string, state: string): string | null {
  const provider = PROVIDERS[providerId];
  const creds = credentials(provider);
  if (!creds) return null;
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('redirect_uri', redirectUri(base, providerId));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider.scope);
  url.searchParams.set('state', state);
  if (providerId === 'google') url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/** Exchanges the authorization code and returns the user's profile. */
export async function completeSignIn(providerId: ProviderId, base: string, code: string): Promise<OAuthProfile> {
  const provider = PROVIDERS[providerId];
  const creds = credentials(provider);
  if (!creds) throw new Error(`${provider.label} sign-in is not configured`);
  const token = await getJson<{ access_token?: string; error?: string }>(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      redirect_uri: redirectUri(base, providerId),
      grant_type: 'authorization_code',
    }),
  });
  if (!token.access_token) throw new Error(`${provider.label} did not return an access token${token.error ? ` (${token.error})` : ''}`);
  return provider.fetchProfile(token.access_token);
}
