import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Fake the Anthropic SDK: record the request, return whatever the test sets.
const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message = 'api error') {
      super(message);
      this.status = status;
    }
  }
  class RateLimitError extends APIError {}
  class BadRequestError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static BadRequestError = BadRequestError;
    static AuthenticationError = AuthenticationError;
    beta = { messages: { parse } };
  }
  return { default: Anthropic };
});

const { describeImage } = await import('../lib/server/vision');
const analyze = (await import('../pages/api/analyze-image')).default;
const Anthropic = (await import('@anthropic-ai/sdk')).default as any;

const DESCRIPTION = {
  subject: 'a red bicycle', details: 'steel frame', setting: 'brick wall', composition: 'centered',
  camera: 'eye level, 35mm', lighting: 'overcast daylight', colors: ['red', 'brick'], style: 'street photography',
  mood: 'calm', text: '', prompt: 'A street photo of a red bicycle against a brick wall, overcast light.',
};
const IMAGE = 'A'.repeat(200);

const env = { ...process.env };
beforeEach(() => {
  parse.mockReset();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  delete process.env.VISION_MODEL;
  delete process.env.DATABASE_URL;
});
afterEach(() => {
  process.env = { ...env };
});

async function post(body: unknown) {
  const out = { status: 200, body: undefined as any };
  let sent = false;
  const res = {
    get headersSent() { return sent; },
    status(c: number) { out.status = c; return res; },
    json(b: unknown) { out.body = b; sent = true; return res; },
    end() { sent = true; return res; },
    setHeader() { return res; },
  };
  const req = { method: 'POST', body, query: {}, url: '/api/analyze-image', headers: { 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.1` }, socket: {} };
  await analyze(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return out;
}

describe('describeImage', () => {
  it('sends the photo with structured output, low effort and server-side fallbacks', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: DESCRIPTION });
    await expect(describeImage(IMAGE, 'image/jpeg')).resolves.toEqual(DESCRIPTION);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5');
    expect(params.output_config.effort).toBe('low');
    expect(params.output_config.format).toBeDefined();
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(params.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: IMAGE } });
  });

  it('lets the owner choose the model', async () => {
    process.env.VISION_MODEL = 'claude-haiku-4-5';
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: DESCRIPTION });
    await describeImage(IMAGE, 'image/png');
    expect(parse.mock.calls[0][0].model).toBe('claude-haiku-4-5');
  });

  it('turns a refusal into a friendly 422', async () => {
    parse.mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 422 });
  });

  it('reports 503 when the output does not parse or the key is missing', async () => {
    parse.mockResolvedValue({ stop_reason: 'max_tokens', parsed_output: null });
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
    delete process.env.ANTHROPIC_API_KEY;
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
  });

  it('maps rate limits to 429', async () => {
    parse.mockRejectedValue(new Anthropic.RateLimitError(429));
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 429 });
  });
});

describe('POST /api/analyze-image', () => {
  it('returns the description (no database: guest mode)', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: DESCRIPTION });
    const res = await post({ image: IMAGE, mediaType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.description.subject).toBe('a red bicycle');
  });

  it('validates the image payload', async () => {
    expect((await post({ image: 'data:image/jpeg;base64,' + IMAGE, mediaType: 'image/jpeg' })).status).toBe(400);
    expect((await post({ image: IMAGE, mediaType: 'image/tiff' })).status).toBe(400);
    expect(parse).not.toHaveBeenCalled();
  });

  it('requires sign-in when accounts are enabled', async () => {
    process.env.DATABASE_URL = 'postgresql://unused';
    const res = await post({ image: IMAGE, mediaType: 'image/jpeg' });
    expect(res.status).toBe(401);
    expect(parse).not.toHaveBeenCalled();
  });
});
