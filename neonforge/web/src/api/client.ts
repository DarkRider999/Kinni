import type {
  Batch,
  Job,
  MediaFile,
  Me,
  Preset,
  RecipeBody,
  SavedRecipe,
  UserSettings,
} from "./types";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
const TOKEN_KEY = "nf.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) – session-only login */
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, err.code ?? "HTTP_ERROR", err.message ?? res.statusText, err.details);
  }
  return data as T;
}

/** Multipart upload with progress (fetch has no upload progress events). */
export function uploadFile(file: File, onProgress?: (fraction: number) => void): Promise<MediaFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/v1/files`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as MediaFile);
      else {
        const err = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } }).error;
        reject(new ApiError(xhr.status, err?.code ?? "UPLOAD_FAILED", err?.message ?? "upload failed", err?.details));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "network error during upload"));
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

export const api = {
  devLogin: (email: string, plan: string) =>
    request<{ access_token: string; user: Me }>("POST", "/auth/dev-login", { email, plan }),
  me: () => request<Me>("GET", "/me"),
  getSettings: () => request<UserSettings>("GET", "/me/settings"),
  putSettings: (s: Partial<UserSettings>) => request<UserSettings>("PUT", "/me/settings", s),

  files: (kind?: string) => request<{ items: MediaFile[] }>("GET", `/files${kind ? `?kind=${kind}` : ""}`),
  file: (id: string) => request<MediaFile>("GET", `/files/${id}`),
  deleteFile: (id: string) => request<void>("DELETE", `/files/${id}`),

  ops: () => request<{ supported: string[]; planned: string[] }>("GET", "/ops"),
  presets: (category?: string) =>
    request<{ items: Preset[] }>("GET", `/presets${category ? `?category=${category}` : ""}`),
  recipes: () => request<{ items: SavedRecipe[] }>("GET", "/recipes"),
  saveRecipe: (name: string, body: RecipeBody) => request<SavedRecipe>("POST", "/recipes", { name, body }),
  deleteRecipe: (id: string) => request<void>("DELETE", `/recipes/${id}`),
  estimate: (recipe: RecipeBody, file_ids: string[]) =>
    request<{ total_credits: number; balance: number; affordable: boolean }>("POST", "/recipes/estimate", {
      recipe,
      file_ids,
    }),

  preview: (file_id: string, recipe: RecipeBody, at_ms = 0) =>
    request<Job>("POST", "/previews", { file_id, recipe, at_ms }),
  render: (file_id: string, recipe: RecipeBody) => request<Job>("POST", "/jobs", { file_id, recipe }),
  jobs: () => request<{ items: Job[] }>("GET", "/jobs"),
  job: (id: string) => request<Job>("GET", `/jobs/${id}`),
  cancelJob: (id: string) => request<Job>("POST", `/jobs/${id}/cancel`),
  retryJob: (id: string) => request<Job>("POST", `/jobs/${id}/retry`),

  createBatch: (file_ids: string[], recipe: RecipeBody, name?: string) =>
    request<Batch>("POST", "/batches", { file_ids, recipe, name }),
  batches: () => request<{ items: Batch[] }>("GET", "/batches"),
  batch: (id: string) => request<Batch>("GET", `/batches/${id}`),
  batchJobs: (id: string) => request<{ items: Job[] }>("GET", `/batches/${id}/jobs`),
  batchAction: (id: string, action: "pause" | "resume" | "cancel" | "retry-failed") =>
    request<Batch>("POST", `/batches/${id}/${action}`),
  batchDownload: (id: string) => request<{ url: string; files: number }>("POST", `/batches/${id}/download`),
};

export function wsUrl(): string {
  const token = getToken() ?? "";
  return `${API_URL.replace(/^http/, "ws")}/v1/ws?token=${encodeURIComponent(token)}`;
}
