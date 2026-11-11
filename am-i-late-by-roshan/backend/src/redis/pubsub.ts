import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

export const CHANNELS = {
  trafficUpdates: 'traffic:updates',
  userNotifications: (userId: string) => `notifications:user:${userId}`,
};

export type Handler = (message: Record<string, unknown>) => void;

export interface EventBus {
  readonly kind: 'redis' | 'memory';
  publish(channel: string, message: Record<string, unknown>): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe(channel: string, handler: Handler): () => void;
  close(): Promise<void>;
}

/** Single-process bus, used when REDIS_URL is empty (dev, tests, one-instance deployments). */
class MemoryBus implements EventBus {
  readonly kind = 'memory' as const;
  private emitter = new EventEmitter().setMaxListeners(0);

  async publish(channel: string, message: Record<string, unknown>) {
    this.emitter.emit(channel, message);
  }

  subscribe(channel: string, handler: Handler) {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }

  async close() {
    this.emitter.removeAllListeners();
  }
}

/** Redis pub/sub fan-out so every backend instance sees traffic updates and user notifications. */
class RedisBus implements EventBus {
  readonly kind = 'redis' as const;
  private pub: Redis;
  private sub: Redis;
  private local = new EventEmitter().setMaxListeners(0);
  private refCounts = new Map<string, number>();

  constructor(url: string) {
    const opts = { maxRetriesPerRequest: 2, lazyConnect: false };
    this.pub = new Redis(url, opts);
    this.sub = new Redis(url, opts);
    for (const [name, client] of [['publisher', this.pub], ['subscriber', this.sub]] as const) {
      client.on('error', (err) => logger.warn({ err: err.message }, `Redis ${name} error`));
    }
    this.sub.on('message', (channel: string, raw: string) => {
      try {
        this.local.emit(channel, JSON.parse(raw));
      } catch (err) {
        logger.warn({ channel, err }, 'Dropping malformed pub/sub message');
      }
    });
  }

  async publish(channel: string, message: Record<string, unknown>) {
    try {
      await this.pub.publish(channel, JSON.stringify(message));
    } catch (err) {
      // Redis being down must never break the request that triggered the publish;
      // deliver to local subscribers at least.
      logger.warn({ err: (err as Error).message, channel }, 'Redis publish failed; delivering locally only');
      this.local.emit(channel, message);
    }
  }

  subscribe(channel: string, handler: Handler) {
    this.local.on(channel, handler);
    const count = (this.refCounts.get(channel) ?? 0) + 1;
    this.refCounts.set(channel, count);
    if (count === 1) this.sub.subscribe(channel).catch((err) => logger.warn({ err: err.message, channel }, 'Redis subscribe failed'));
    return () => {
      this.local.off(channel, handler);
      const left = (this.refCounts.get(channel) ?? 1) - 1;
      if (left <= 0) {
        this.refCounts.delete(channel);
        this.sub.unsubscribe(channel).catch(() => undefined);
      } else {
        this.refCounts.set(channel, left);
      }
    };
  }

  async close() {
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
  }
}

let bus: EventBus | null = null;

export function getBus(): EventBus {
  if (!bus) {
    bus = config.redisUrl ? new RedisBus(config.redisUrl) : new MemoryBus();
    logger.info({ kind: bus.kind }, 'Event bus ready');
  }
  return bus;
}

export function setBusForTests(custom: EventBus): void {
  bus = custom;
}

export function createMemoryBus(): EventBus {
  return new MemoryBus();
}
