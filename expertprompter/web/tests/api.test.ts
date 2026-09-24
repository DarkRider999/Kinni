import { afterEach, describe, expect, it } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import generate from '../pages/api/generate-prompt';
import health from '../pages/api/health';
import meta from '../pages/api/meta';
import listPrompts from '../pages/api/prompts';
import register from '../pages/api/auth/register';
import me from '../pages/api/auth/me';
import { signToken } from '../lib/server/services/authService';

// Minimal req/res doubles; these routes run without a database.
interface Result {
  status: number;
  body: any;
  headers: Record<string, string>;
}

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; query?: Record<string, string>; ip?: string } = {},
): Promise<Result> {
  const result: Result = { status: 200, body: undefined, headers: {} };
  let sent = false;
  const res = {
    get headersSent() { return sent; },
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; sent = true; return res; },
    end() { sent = true; return res; },
    setHeader(k: string, v: string) { result.headers[k.toLowerCase()] = v; return res; },
  };
  const req = {
    method: init.method ?? 'GET',
    body: init.body,
    query: init.query ?? {},
    url: '/api/test',
    headers: { 'x-forwarded-for': init.ip ?? '10.0.0.1', ...(init.headers ?? {}) },
    socket: {},
  };
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return result;
}

const savedDbUrl = process.env.DATABASE_URL;
afterEach(() => {
  if (savedDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDbUrl;
});

describe('API routes', () => {
  it('GET /api/health', async () => {
    const res = await call(health);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/generate-prompt works for guests', async () => {
    const res = await call(generate, {
      method: 'POST',
      body: { rawInput: 'Create a business plan for a cloud kitchen in Dubai.', promptStyle: 'professional', options: { tone: 'confident' } },
    });
    expect(res.status).toBe(200);
    expect(res.body.detectedCategory).toBe('BUSINESS');
    expect(res.body.recommendedTools).toContain('ChatGPT');
    expect(res.body.generatedPrompt).toMatch(/^Create a professional business plan/);
    expect(res.body.savedPromptId).toBeUndefined();
    expect(res.body.templateKey).toBeUndefined();
  });

  it('validates input', async () => {
    const res = await call(generate, { method: 'POST', body: { rawInput: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.rawInput).toBeDefined();
  });

  it('rejects an unknown style', async () => {
    const res = await call(generate, { method: 'POST', body: { rawInput: 'write a poem', promptStyle: 'weird' } });
    expect(res.status).toBe(400);
  });

  it('rejects the wrong HTTP method with 405 and an Allow header', async () => {
    const res = await call(generate, { method: 'GET' });
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('POST');
  });

  it('rate limits per client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) {
      statuses.push((await call(generate, { method: 'POST', body: { rawInput: 'write a poem' }, ip: '10.9.9.9' })).status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('protects history routes', async () => {
    expect((await call(listPrompts)).status).toBe(401);
    expect((await call(listPrompts, { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
  });

  it('returns 503 for accounts when no database is configured', async () => {
    delete process.env.DATABASE_URL;
    const res = await call(register, { method: 'POST', body: { email: 'a@example.com', password: 'supersecret1' } });
    expect(res.status).toBe(503);
  });

  it('GET /api/auth/me decodes a valid token', async () => {
    const token = signToken({ id: 'u1', email: 'a@example.com' });
    const res = await call(me, { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'u1', email: 'a@example.com' });
  });

  it('GET /api/meta lists categories and styles', async () => {
    const res = await call(meta);
    expect(res.body.styles).toEqual(['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'EDUCATIONAL']);
  });
});
