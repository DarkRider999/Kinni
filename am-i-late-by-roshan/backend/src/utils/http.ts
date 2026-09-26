import { config } from '../config';

export class ExternalHttpDisabledError extends Error {
  constructor() {
    super('External HTTP calls are disabled (EXTERNAL_HTTP_ENABLED=false)');
  }
}

/** fetch() with a timeout that returns parsed JSON or throws. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number; external?: boolean } = {},
): Promise<T> {
  const { timeoutMs = config.externalHttpTimeoutMs, external = true, ...rest } = init;
  if (external && !config.externalHttpEnabled) throw new ExternalHttpDisabledError();
  const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Tiny TTL cache for third-party lookups (weather, speed limits, geocoding). */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  constructor(
    private ttlMs: number,
    private maxEntries = 2000,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}
