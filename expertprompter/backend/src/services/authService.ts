import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { conflict, unauthorized } from '../lib/httpError';
import type { AuthUser } from '../middleware/auth';

const BCRYPT_ROUNDS = 12;
// Real hash of a random value, so logins for unknown emails cost the same as real ones.
const DUMMY_HASH = bcrypt.hashSync(Math.random().toString(36), BCRYPT_ROUNDS);

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
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

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Compare even when the user is missing so timing does not reveal which emails exist.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Invalid email or password');
  const authUser = { id: user.id, email: user.email };
  return { user: authUser, token: signToken(authUser) };
}
