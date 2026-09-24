import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';
import { badRequest } from '../lib/httpError';

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(badRequest('Validation failed', z.flattenError(result.error).fieldErrors));
    }
    req.body = result.data;
    next();
  };
}
