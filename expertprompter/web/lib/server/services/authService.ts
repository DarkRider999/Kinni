import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { jwtExpiresIn, jwtSecret } from '../env';
import { prisma } from '../prisma';
import { conflict, unauthorized } from '../httpError';

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

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok) throw unauthorized('Invalid email or password');
  const authUser = { id: user.id, email: user.email };
  return { user: authUser, token: signToken(authUser) };
}
