import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { jwtExpiresIn, jwtSecret } from '../env';
import { prisma } from '../prisma';
import { badRequest, conflict, unauthorized } from '../httpError';
import type { OAuthProfile } from '../oauth';

export interface AuthUser {
  id: string;
  email: string;
}

const BCRYPT_ROUNDS = 12;
// Real hash of a random value, so logins for unknown emails cost the same as real ones.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync(Math.random().toString(36), BCRYPT_ROUNDS));

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email }, jwtSecret(), {
    subject: user.id,
    expiresIn: jwtExpiresIn() as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function register(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({ data: { email: normalized, passwordHash } });
  const authUser = { id: user.id, email: user.email };
  return { user: authUser, token: signToken(authUser) };
}

/** `identifier` is an email address or a username. */
export async function login(identifier: string, password: string) {
  const key = identifier.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: key.includes('@') ? { email: key } : { username: key } });
  // Accounts created with Google/Facebook/GitHub have no password.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !user.passwordHash || !ok) throw unauthorized('Invalid email or password');
  const authUser = { id: user.id, email: user.email };
  return { user: authUser, token: signToken(authUser) };
}

/**
 * Finds or creates the user for a provider sign-in and returns a session.
 *
 * - A known provider account signs straight in.
 * - Otherwise, a provider-verified email links to an existing user with that
 *   email. Linking clears any password on that account: it was set without
 *   proving ownership of the email, so it must not keep working once the real
 *   owner has signed in. (This also stops anyone pre-registering the owner's
 *   email to hijack master access.)
 * - Unverified provider emails never link; they need a fresh account.
 */
export async function signInWithProvider(provider: string, profile: OAuthProfile) {
  const existingLink = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
    include: { user: true },
  });

  let user = existingLink?.user;
  if (!user) {
    if (!profile.email) throw badRequest('Your account did not share an email address. Please allow email access and try again.');
    const email = profile.email.trim().toLowerCase();
    const byEmail = await prisma.user.findUnique({ where: { email } });

    if (byEmail && !profile.emailVerified) {
      throw conflict('An account with this email already exists. Sign in with your password instead.');
    }

    user = byEmail
      ? await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            emailVerified: byEmail.emailVerified ?? new Date(),
            passwordHash: byEmail.emailVerified ? byEmail.passwordHash : null,
            name: byEmail.name ?? profile.name,
            image: byEmail.image ?? profile.image,
            accounts: { create: { provider, providerAccountId: profile.providerAccountId } },
          },
        })
      : await prisma.user.create({
          data: {
            email,
            name: profile.name,
            image: profile.image,
            emailVerified: profile.emailVerified ? new Date() : null,
            accounts: { create: { provider, providerAccountId: profile.providerAccountId } },
          },
        });
  }

  const authUser = { id: user.id, email: user.email };
  return { user: authUser, token: signToken(authUser) };
}
