import type { NextApiRequest, NextApiResponse } from 'next';

/** Holds `<provider>:<state>` between the OAuth redirect and its callback. */
export const STATE_COOKIE = 'ep_oauth_state';

interface CookieOptions {
  maxAge: number;
  path: string;
}

export function setCookie(req: NextApiRequest, res: NextApiResponse, name: string, value: string, opts: CookieOptions) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${name}=${encodeURIComponent(value)}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
  );
}

export function readCookie(req: NextApiRequest, name: string): string | null {
  const value = req.cookies?.[name];
  return value ? decodeURIComponent(value) : null;
}
