import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, userIdOf } from '../middleware/auth';
import { answer } from '../services/assistant_service';
import { latLng } from './schemas';

export const assistantRouter = Router();
assistantRouter.use(requireAuth);
assistantRouter.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

/** POST /assistant/chat { message, location?, history? } */
assistantRouter.post('/chat', async (req, res) => {
  const body = z
    .object({
      message: z.string().trim().min(1).max(1000),
      location: latLng.optional(),
      history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(20).optional(),
    })
    .parse(req.body);
  const result = await answer(userIdOf(req), body.message, { location: body.location, history: body.history });
  res.json({ reply: result.reply, intent: result.intent, source: result.source, tripPlan: result.plan ?? null });
});
