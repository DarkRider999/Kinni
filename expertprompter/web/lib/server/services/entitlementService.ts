// Decides who may generate prompts:
//   MASTER  - accounts flagged isMaster by an admin, or owner emails in
//             MASTER_EMAILS once the email is verified by a provider
//   PREMIUM - an active or trialing Stripe subscription
//   FREE    - everyone else, limited to FREE_RUN_LIMIT generations in total

import type { User } from '@prisma/client';
import { FREE_RUN_LIMIT, masterEmails } from '../env';
import { prisma } from '../prisma';
import { unauthorized } from '../httpError';

export type Plan = 'MASTER' | 'PREMIUM' | 'FREE';

export interface Entitlement {
  plan: Plan;
  freeRunsUsed: number;
  freeRunsLimit: number;
  /** null when unlimited. */
  freeRunsRemaining: number | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

type EntitlementUser = Pick<User, 'email' | 'emailVerified' | 'freeRunsUsed' | 'subscriptionStatus' | 'currentPeriodEnd'> & {
  isMaster?: boolean;
};

const PREMIUM_STATUSES = new Set(['active', 'trialing']);

export function planFor(user: EntitlementUser, now = new Date()): Plan {
  if (user.isMaster) return 'MASTER';
  if (user.emailVerified && masterEmails().includes(user.email.toLowerCase())) return 'MASTER';
  if (
    user.subscriptionStatus &&
    PREMIUM_STATUSES.has(user.subscriptionStatus) &&
    (!user.currentPeriodEnd || user.currentPeriodEnd > now)
  ) {
    return 'PREMIUM';
  }
  return 'FREE';
}

export function entitlementFor(user: EntitlementUser): Entitlement {
  const plan = planFor(user);
  return {
    plan,
    freeRunsUsed: user.freeRunsUsed,
    freeRunsLimit: FREE_RUN_LIMIT,
    freeRunsRemaining: plan === 'FREE' ? Math.max(0, FREE_RUN_LIMIT - user.freeRunsUsed) : null,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
  };
}

/**
 * Charges one generation against the user's plan. Returns the updated
 * entitlement, or null when the free runs are used up. The free-run
 * increment is a single conditional UPDATE, so parallel requests cannot
 * exceed the limit.
 */
export async function consumeRun(userId: string): Promise<Entitlement | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('Account not found');
  if (planFor(user) !== 'FREE') return entitlementFor(user);

  const { count } = await prisma.user.updateMany({
    where: { id: userId, freeRunsUsed: { lt: FREE_RUN_LIMIT } },
    data: { freeRunsUsed: { increment: 1 } },
  });
  if (count === 0) return null;
  return entitlementFor({ ...user, freeRunsUsed: user.freeRunsUsed + 1 });
}
