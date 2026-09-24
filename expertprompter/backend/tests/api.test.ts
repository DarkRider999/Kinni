import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

// These routes do not touch the database, so no Postgres is required.
const app = createApp();

describe('API', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/generate-prompt works for guests', async () => {
    const res = await request(app)
      .post('/api/generate-prompt')
      .send({ rawInput: 'Create a business plan for a cloud kitchen in Dubai.', promptStyle: 'professional', options: { tone: 'confident' } });
    expect(res.status).toBe(200);
    expect(res.body.detectedCategory).toBe('BUSINESS');
    expect(res.body.recommendedTools).toContain('ChatGPT');
    expect(res.body.generatedPrompt).toMatch(/^Create a professional business plan/);
    expect(res.body.savedPromptId).toBeUndefined();
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/generate-prompt').send({ rawInput: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.rawInput).toBeDefined();
  });

  it('rejects an unknown style', async () => {
    const res = await request(app).post('/api/generate-prompt').send({ rawInput: 'write a poem', promptStyle: 'weird' });
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app).post('/api/generate-prompt').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  it('protects history routes', async () => {
    expect((await request(app).get('/api/prompts')).status).toBe(401);
    expect((await request(app).get('/api/prompts').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('GET /api/meta lists categories and styles', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body.styles).toEqual(['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'EDUCATIONAL']);
  });

  it('only sends CORS headers to allowed origins', async () => {
    const ok = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const blocked = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('/nope');
  });
});
