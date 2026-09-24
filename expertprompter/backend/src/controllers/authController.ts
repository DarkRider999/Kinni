import type { Request, Response } from 'express';
import * as auth from '../services/authService';

export async function registerHandler(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  res.status(201).json(await auth.register(email, password));
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  res.json(await auth.login(email, password));
}

export function meHandler(req: Request, res: Response) {
  res.json({ user: req.user });
}
