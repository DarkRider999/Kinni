import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  redact: ['req.headers.authorization', 'password', 'password_hash', '*.password', '*.token'],
});
