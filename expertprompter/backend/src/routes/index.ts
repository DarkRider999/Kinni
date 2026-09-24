import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { CredentialsSchema, GenerateSchema, SavePromptSchema } from '../lib/schemas';
import { generatePromptHandler } from '../controllers/generateController';
import * as prompts from '../controllers/promptController';
import { loginHandler, meHandler, registerHandler } from '../controllers/authController';
import { metaHandler, templatesHandler } from '../controllers/metaController';

export const api = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const generateLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false });

// Generation (guest or logged in)
api.post('/generate-prompt', generateLimiter, optionalAuth, validateBody(GenerateSchema), generatePromptHandler);

// Auth
api.post('/auth/register', authLimiter, validateBody(CredentialsSchema), registerHandler);
api.post('/auth/login', authLimiter, validateBody(CredentialsSchema), loginHandler);
api.get('/auth/me', requireAuth, meHandler);

// Saved prompts / history (logged in)
api.get('/prompts', requireAuth, prompts.listPrompts);
api.post('/prompts/save', requireAuth, validateBody(SavePromptSchema), prompts.savePrompt);
api.get('/prompts/:id', requireAuth, prompts.getPrompt);
api.patch('/prompts/:id/favorite', requireAuth, prompts.toggleFavorite);
api.delete('/prompts/:id', requireAuth, prompts.deletePrompt);

// Metadata
api.get('/meta', metaHandler);
api.get('/templates', optionalAuth, templatesHandler);
