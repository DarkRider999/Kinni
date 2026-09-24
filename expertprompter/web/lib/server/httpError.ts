export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const methodNotAllowed = () => new HttpError(405, 'Method not allowed');
export const tooManyRequests = () => new HttpError(429, 'Too many requests, please slow down');
export const serviceUnavailable = (msg: string) => new HttpError(503, msg);
