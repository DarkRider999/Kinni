export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'error',
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'not_found');
export const badRequest = (message: string) => new HttpError(400, message, 'bad_request');
