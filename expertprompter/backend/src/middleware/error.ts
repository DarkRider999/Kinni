import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });
}

// Express recognises error handlers by their 4-argument signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { message: 'Malformed JSON body' } });
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
  res.status(500).json({ error: { message: 'Internal server error' } });
}
