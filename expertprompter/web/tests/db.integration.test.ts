// Runs against a real Postgres when DATABASE_URL is set (skipped otherwise):
//   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy && npm test
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Stripe API calls are faked; webhook signatures use Stripe's real verifier.
const retrieve = vi.fn();
vi.mock('../lib/server/stripe', () => ({
  stripe: () => ({ subscriptions: { retrieve }, webhooks: new Stripe('sk_test_dummy').webhooks }),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

async function call(handler: (req: NextApiRequest, res: NextApiResponse) => unknown, init: { method?: string; body?: unknown; headers?: Record<string, string>; rawBody?: string } = {}) {
  const result = { status: 200, body: undefined as any };
  let sent = false;
  const res = {
    get headersSent() { return sent; },
    status(c: number) { result.status = c; return res; },
    json(b: unknown) { result.body = b; sent = true; return res; },
    end() { sent = true; return res; },
    setHeader() { return res; },
  };
  const chunks = init.rawBody !== undefined ? [Buffer.from(init.rawBody)] : [];
  const req = Object.assign(
    { async *[Symbol.asyncIterator]() { yield* chunks; } },
    { method: init.method ?? 'POST', body: init.body, query: {}, url: `/api/test-${Math.random()}`, headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 250)}.1`, ...(init.headers ?? {}) }, socket: {}, cookies: {} },
  );
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return result;
}

describe.skipIf(!hasDb)('accounts, free runs and billing (database)', async () => {
  const { prisma } = await import('../lib/server/prisma');
  const { signToken, register, login, signInWithProvider } = await import('../lib/server/services/authService');
  const { consumeRun } = await import('../lib/server/services/entitlementService');
  const generate = (await import('../pages/api/generate-prompt')).default;
  const webhook = (await import('../pages/api/billing/webhook')).default;

  beforeEach(async () => {
    await prisma.prompt.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    process.env.MASTER_EMAILS = 'owner@example.com';
    retrieve.mockReset();
  });

  const bearer = (u: { id: string; email: string }) => ({ authorization: `Bearer ${signToken(u)}` });
  const body = { rawInput: 'Write a poem about the sea' };

  it('requires sign-in to generate', async () => {
    const res = await call(generate, { body });
    expect(res.status).toBe(401);
    expect(res.body.error.details.code).toBe('AUTH_REQUIRED');
  });

  it('allows exactly 5 free runs, then returns 402 PAYWALL', async () => {
    const { user } = await register('free@example.com', 'supersecret1');
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await call(generate, { body, headers: bearer(user) })).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 402]);
    const last = await call(generate, { body, headers: bearer(user) });
    expect(last.body.error.details.code).toBe('PAYWALL');
  });

  it('never exceeds the limit under concurrent requests', async () => {
    const { user } = await register('race@example.com', 'supersecret1');
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRun(user.id)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).freeRunsUsed).toBe(5);
  });

  it('reports remaining runs in the generate response', async () => {
    const { user } = await register('count@example.com', 'supersecret1');
    const res = await call(generate, { body, headers: bearer(user) });
    expect(res.body.entitlement).toMatchObject({ plan: 'FREE', freeRunsRemaining: 4 });
  });

  it('does not make a password-registered owner email a master', async () => {
    const { user } = await register('owner@example.com', 'impostor123');
    for (let i = 0; i < 5; i++) await consumeRun(user.id);
    expect(await consumeRun(user.id)).toBeNull();
  });

  it('verified provider sign-in grants master, links the account and revokes a pre-set password', async () => {
    await register('owner@example.com', 'impostor123');
    const session = await signInWithProvider('google', { providerAccountId: 'g-1', email: 'Owner@Example.com', emailVerified: true, name: 'Owner', image: null });
    await expect(login('owner@example.com', 'impostor123')).rejects.toThrow('Invalid email or password');
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await call(generate, { body, headers: bearer(session.user) })).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
    const again = await signInWithProvider('google', { providerAccountId: 'g-1', email: 'owner@example.com', emailVerified: true, name: null, image: null });
    expect(again.user.id).toBe(session.user.id);
    expect(await prisma.account.count()).toBe(1);
  });

  it('refuses to link an unverified provider email to an existing account', async () => {
    await register('taken@example.com', 'supersecret1');
    await expect(
      signInWithProvider('facebook', { providerAccountId: 'f-1', email: 'taken@example.com', emailVerified: false, name: null, image: null }),
    ).rejects.toThrow('already exists');
  });

  it('activates Premium from a signed Stripe webhook', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    const { user } = await register('payer@example.com', 'supersecret1');
    for (let i = 0; i < 5; i++) await consumeRun(user.id);

    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    retrieve.mockResolvedValue({ id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { userId: user.id }, items: { data: [{ current_period_end: periodEnd }] } });

    const payload = JSON.stringify({
      id: 'evt_1', object: 'event', type: 'checkout.session.completed',
      data: { object: { object: 'checkout.session', mode: 'subscription', subscription: 'sub_1', client_reference_id: user.id } },
    });
    const bad = await call(webhook, { rawBody: payload, headers: { 'stripe-signature': 't=1,v1=forged' } });
    expect(bad.status).toBe(400);

    const signature = new Stripe('sk_test_dummy').webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
    const ok = await call(webhook, { rawBody: payload, headers: { 'stripe-signature': signature } });
    expect(ok.status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith('sub_1');

    const res = await call(generate, { body, headers: bearer(user) });
    expect(res.status).toBe(200);
    expect(res.body.entitlement.plan).toBe('PREMIUM');

    // Cancellation (looked up by customer id) drops them back to the exhausted free plan.
    retrieve.mockResolvedValue({ id: 'sub_1', customer: 'cus_1', status: 'canceled', metadata: {}, items: { data: [{ current_period_end: periodEnd }] } });
    const cancelPayload = JSON.stringify({ id: 'evt_2', object: 'event', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', object: 'subscription' } } });
    const cancelSig = new Stripe('sk_test_dummy').webhooks.generateTestHeaderString({ payload: cancelPayload, secret: 'whsec_test_secret' });
    expect((await call(webhook, { rawBody: cancelPayload, headers: { 'stripe-signature': cancelSig } })).status).toBe(200);
    expect((await call(generate, { body, headers: bearer(user) })).status).toBe(402);
  });
});
