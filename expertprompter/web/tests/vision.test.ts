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

// Fake Google's SDK the same way.
const generateContent = vi.fn();
vi.mock('@google/genai', () => {
  class ApiError extends Error {
    status: number;
    constructor(opts: { status: number; message: string }) {
      super(opts.message);
      this.status = opts.status;
    }
  }
  class GoogleGenAI {
    models = { generateContent };
  }
  return { GoogleGenAI, ApiError };
});

const { describeImage, visionProvider } = await import('../lib/server/vision');
const GenAI = (await import('@google/genai')) as any;
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
  generateContent.mockReset();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.VISION_PROVIDER;
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

  it('only blames the image for image errors; account problems become 503', async () => {
    parse.mockRejectedValue(new Anthropic.BadRequestError(400, 'Could not process image'));
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 422 });
    parse.mockRejectedValue(new Anthropic.BadRequestError(400, 'Your credit balance is too low to access the Anthropic API.'));
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
  });

  it('maps rate limits to 429', async () => {
    parse.mockRejectedValue(new Anthropic.RateLimitError(429));
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 429 });
  });
});

describe('Gemini (free tier)', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'gm-test';
  });

  it('is preferred when its key is set, unless VISION_PROVIDER says otherwise', () => {
    expect(visionProvider()).toBe('gemini');
    process.env.VISION_PROVIDER = 'anthropic';
    expect(visionProvider()).toBe('anthropic');
    delete process.env.VISION_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    expect(visionProvider()).toBe('anthropic');
    delete process.env.ANTHROPIC_API_KEY;
    expect(visionProvider()).toBeNull();
  });

  it('sends the image with a JSON schema and parses the reply', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(DESCRIPTION) });
    await expect(describeImage(IMAGE, 'image/jpeg')).resolves.toEqual(DESCRIPTION);
    const req = generateContent.mock.calls[0][0];
    expect(req.model).toBe('gemini-flash-latest');
    expect(req.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: IMAGE } });
    expect(req.config.responseMimeType).toBe('application/json');
    expect(req.config.responseJsonSchema.$schema).toBeUndefined();
    expect(req.config.responseJsonSchema.required).toContain('prompt');
    expect(parse).not.toHaveBeenCalled();
  });

  it('lets the owner pick the Gemini model', async () => {
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite';
    generateContent.mockResolvedValue({ text: JSON.stringify(DESCRIPTION) });
    await describeImage(IMAGE, 'image/png');
    expect(generateContent.mock.calls[0][0].model).toBe('gemini-2.5-flash-lite');
  });

  it('explains the free-tier limit on 429', async () => {
    generateContent.mockRejectedValue(new GenAI.ApiError({ status: 429, message: 'quota' }));
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 429, message: expect.stringContaining('free') });
  });

  it('handles blocked, invalid and failed replies', async () => {
    generateContent.mockResolvedValue({ promptFeedback: { blockReason: 'SAFETY' } });
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 422 });
    generateContent.mockResolvedValue({ text: 'not json' });
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
    generateContent.mockResolvedValue({ text: JSON.stringify({ subject: 'only this' }) });
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
    generateContent.mockRejectedValue(new GenAI.ApiError({ status: 400, message: 'API key not valid' }));
    await expect(describeImage(IMAGE, 'image/jpeg')).rejects.toMatchObject({ status: 503 });
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
