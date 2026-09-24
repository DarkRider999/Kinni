// Shared plumbing for API routes: method dispatch, auth, validation, rate
// limiting and consistent `{ error: { message, details } }` responses.

import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { z, type ZodType } from 'zod';
import { hasDatabase } from './env';
import { HttpError, badRequest, methodNotAllowed, serviceUnavailable, tooManyRequests, unauthorized } from './httpError';
import { rateLimit } from './rateLimit';
import { verifyToken, type AuthUser } from './services/authService';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>;

interface Options {
  /** Requests per minute per client IP for this route. */
  rateLimitPerMinute?: number;
}

function clientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return first?.trim() || req.socket?.remoteAddress || 'unknown';
}

function sendError(res: NextApiResponse, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: { message: 'Resource already exists' } });
    if (err.code === 'P2025') return res.status(404).json({ error: { message: 'Resource not found' } });
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('Database unavailable:', err.message);
    return res.status(503).json({ error: { message: 'Database unavailable, please try again later' } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: 'Internal server error' } });
}

export function apiHandler(handlers: Partial<Record<Method, Handler>>, options: Options = {}) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const handler = handlers[req.method as Method];
    try {
      if (!handler) {
        res.setHeader('Allow', Object.keys(handlers).join(', '));
        throw methodNotAllowed();
      }
      if (options.rateLimitPerMinute && !rateLimit(`${req.url}:${clientIp(req)}`, options.rateLimitPerMinute, 60_000)) {
        throw tooManyRequests();
      }
      await handler(req, res);
    } catch (err) {
      if (!res.headersSent) sendError(res, err);
    }
  };
}

function readBearer(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** The signed-in user, or null for guests (invalid tokens count as guests). */
export function optionalUser(req: NextApiRequest): AuthUser | null {
  const token = readBearer(req);
  return token ? verifyToken(token) : null;
}

export function requireUser(req: NextApiRequest): AuthUser {
  const token = readBearer(req);
  if (!token) throw unauthorized();
  const user = verifyToken(token);
  if (!user) throw unauthorized('Invalid or expired token');
  return user;
}

export function requireDatabase() {
  if (!hasDatabase()) throw serviceUnavailable('Accounts are not configured on this deployment');
}

export function parseWith<T>(schema: ZodType<T>, input: unknown, message = 'Validation failed'): T {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw badRequest(message, z.flattenError(result.error).fieldErrors);
  return result.data;
}

/** Route params arrive as string | string[]; normalise to one string. */
export function param(req: NextApiRequest, name: string): string {
  const value = req.query[name];
  return Array.isArray(value) ? value[0] : value ?? '';
}
