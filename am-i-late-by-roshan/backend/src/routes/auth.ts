import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { createUser, findUserByEmail, findUserById } from '../db/models/User';
import { requireAuth, signToken, userIdOf } from '../middleware/auth';
import { HttpError, notFound } from '../utils/http_error';

export const authRouter = Router();

// Compared against when the email is unknown, so response timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', 10);

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.nodeEnv === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } },
});

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const body = credentials.extend({ displayName: z.string().trim().max(80).optional() }).parse(req.body);
  if (await findUserByEmail(body.email)) throw new HttpError(409, 'An account with this email already exists', 'email_taken');
  const hash = await bcrypt.hash(body.password, 10);
  const user = await createUser(body.email, hash, body.displayName || null);
  res.status(201).json({ token: signToken(user.id), user });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = credentials.parse(req.body);
  const user = await findUserByEmail(body.email);
  const ok = await bcrypt.compare(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Incorrect email or password', 'invalid_credentials');
  const { password_hash: _omit, ...safe } = user;
  res.json({ token: signToken(user.id), user: safe });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(userIdOf(req));
  if (!user) throw notFound('User');
  res.json({ user });
});
