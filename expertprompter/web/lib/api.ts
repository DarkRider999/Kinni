import type { AuthUser, Entitlement, GenerateRequest, GenerateResponse, ProvidersInfo, RecommendedTool, SavedPrompt } from './types';

// The API lives in this app (pages/api), so requests are same-origin by default.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }

  /** Machine-readable reason, e.g. AUTH_REQUIRED or PAYWALL. */
  get code(): string | undefined {
    const d = this.details as { code?: unknown } | undefined;
    return typeof d?.code === 'string' ? d.code : undefined;
  }

  /** First field-level validation message, if any. */
  get fieldMessage(): string | undefined {
    if (!this.details || typeof this.details !== 'object' || this.code) return undefined;
    const first = Object.values(this.details as Record<string, unknown>).flat()[0];
    return typeof first === 'string' ? first : undefined;
  }
}

const TOKEN_KEY = 'expertprompter.token';

export const tokenStore = {
  get(): string | null {
    try { return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string | null) {
    try {
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable (private mode) — stay logged in for this tab only */ }
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the ExpertPrompter API. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details);
  }
  return body as T;
}

export const api = {
  generate: (payload: GenerateRequest) =>
    request<GenerateResponse>('/api/generate-prompt', { method: 'POST', body: JSON.stringify(payload) }),

  register: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AuthUser; entitlement: Entitlement | null }>('/api/auth/me'),
  providers: () => request<ProvidersInfo>('/api/auth/providers'),
  meta: () => request<{ tools: Array<Omit<RecommendedTool, 'reason' | 'rank'>> }>('/api/meta'),
  checkout: () => request<{ url: string }>('/api/billing/checkout', { method: 'POST' }),
  billingPortal: () => request<{ url: string }>('/api/billing/portal', { method: 'POST' }),

  listPrompts: (params: { cursor?: string; limit?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.q) qs.set('q', params.q);
    return request<{ items: SavedPrompt[]; nextCursor: string | null }>(`/api/prompts?${qs}`);
  },
  savePrompt: (data: Omit<SavedPrompt, 'id' | 'createdAt' | 'isFavorite' | 'title'> & { title?: string }) =>
    request<SavedPrompt>('/api/prompts/save', { method: 'POST', body: JSON.stringify(data) }),
  toggleFavorite: (id: string) => request<SavedPrompt>(`/api/prompts/${id}/favorite`, { method: 'PATCH' }),
  deletePrompt: (id: string) => request<void>(`/api/prompts/${id}`, { method: 'DELETE' }),
};
