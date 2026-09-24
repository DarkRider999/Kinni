import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/authService';
import { unauthorized } from '../lib/httpError';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Rejects the request unless a valid JWT is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next(unauthorized());
  const user = verifyToken(token);
  if (!user) return next(unauthorized('Invalid or expired token'));
  req.user = user;
  next();
}

/** Attaches the user when a valid token is present; guests pass through. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (token) {
    const user = verifyToken(token);
    if (user) req.user = user;
  }
  next();
}
