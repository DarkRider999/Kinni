// Talks to public/photo-ai-worker.js, which runs the Florence-2 image model in
// the browser. Nothing is sent to a server; the model downloads once (~215 MB)
// and the browser caches it.

export const MODEL_DOWNLOAD_MB = 215;
const CONSENT_KEY = 'expertprompter.photoAi';
const CACHE_NAME = 'transformers-cache'; // transformers.js default cache
const MODEL_ID = 'Florence-2-base-ft';

type Pending = { resolve: (caption: string) => void; reject: (err: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const progressListeners = new Set<(fraction: number) => void>();

export function photoAiSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly === 'object';
}

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function giveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, 'yes');
  } catch {
    // Storage blocked: ask again next visit.
  }
}

/** True when the model files are already in the browser cache (no download needed). */
export async function isModelCached(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.some((req) => req.url.includes(MODEL_ID) && req.url.includes('decoder_model_merged'));
  } catch {
    return false;
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker('/photo-ai-worker.js', { type: 'module' });
  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data ?? {};
    if (msg.type === 'progress' && msg.total) {
      for (const listener of progressListeners) listener(Math.min(1, msg.loaded / msg.total));
    } else if (msg.type === 'result' || msg.type === 'error') {
      const job = pending.get(msg.id);
      if (!job) return;
      pending.delete(msg.id);
      if (msg.type === 'result') job.resolve(msg.caption);
      else job.reject(new Error(msg.message || 'On-device AI failed'));
    }
  };
  worker.onerror = (event) => {
    // e.g. the CDN script could not load: fail every waiting job and start fresh next time.
    const err = new Error(event.message || 'On-device AI could not start');
    for (const job of pending.values()) job.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Captions an image on this device. `onProgress` reports the one-time model download (0..1). */
export function describeOnDevice(image: Blob, onProgress?: (fraction: number) => void): Promise<string> {
  const id = nextId++;
  if (onProgress) progressListeners.add(onProgress);
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'describe', id, image });
  }).finally(() => {
    if (onProgress) progressListeners.delete(onProgress);
  });
}
