import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../utils/http_error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  return jwt.sign({}, config.jwtSecret, {
    subject: userId,
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    issuer: 'am-i-late',
  });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, config.jwtSecret, { issuer: 'am-i-late' }) as TokenPayload;
  if (!payload.sub) throw new Error('Token has no subject');
  return payload.sub;
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Requires a valid JWT and sets req.userId. The client never sends user_id itself. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearer(req);
  if (!token) return next(new HttpError(401, 'Missing bearer token', 'unauthorized'));
  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token', 'unauthorized'));
  }
}

/** Sets req.userId when a valid token is present, but lets anonymous requests through. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearer(req);
  if (token) {
    try {
      req.userId = verifyToken(token);
    } catch {
      return next(new HttpError(401, 'Invalid or expired token', 'unauthorized'));
    }
  }
  next();
}

export function userIdOf(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'Not authenticated', 'unauthorized');
  return req.userId;
}
