import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, getToken, setToken, wsUrl } from "../api/client";
import type { BatchEvent, JobEvent, Me, ServerEvent } from "../api/types";

interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  text: string;
}

interface AppState {
  me: Me | null;
  loading: boolean;
  login: (email: string, plan: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  jobs: Record<string, JobEvent>;
  batches: Record<string, BatchEvent>;
  subscribe: (fn: (ev: ServerEvent) => void) => () => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  toasts: Toast[];
  connected: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Record<string, JobEvent>>({});
  const [batches, setBatches] = useState<Record<string, BatchEvent>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<(ev: ServerEvent) => void>());
  const toastId = useRef(0);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      setMe(await api.me());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  // Live job/batch events over WebSocket, with exponential-backoff reconnect.
  useEffect(() => {
    if (!me) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onmessage = (m) => {
        const ev = JSON.parse(m.data) as ServerEvent;
        if (ev.type === "job.progress") setJobs((j) => ({ ...j, [ev.job_id]: ev }));
        else if (ev.type === "batch.progress") setBatches((b) => ({ ...b, [ev.id]: ev }));
        listeners.current.forEach((fn) => fn(ev));
      };
      ws.onclose = () => {
        setConnected(false);
        if (stopped) return;
        timer = setTimeout(connect, Math.min(15000, 500 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Credits change when jobs finish: refresh the balance on terminal events.
  useEffect(() => {
    const fn = (ev: ServerEvent) => {
      if (ev.type === "job.progress" && ev.kind === "render" && ["succeeded", "failed", "cancelled"].includes(ev.status))
        void refreshMe();
    };
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, [refreshMe]);

  const value = useMemo<AppState>(
    () => ({
      me,
      loading,
      jobs,
      batches,
      toasts,
      connected,
      toast,
      refreshMe,
      login: async (email, plan) => {
        const r = await api.devLogin(email, plan);
        setToken(r.access_token);
        setMe(r.user);
      },
      logout: () => {
        setToken(null);
        setMe(null);
      },
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
    }),
    [me, loading, jobs, batches, toasts, connected, toast, refreshMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

/** Follow one job until it's final: live events plus a slow poll as a safety net. */
export function useJobWatcher() {
  const { subscribe } = useApp();
  return useCallback(
    (jobId: string, onUpdate: (ev: { status: string; progress: number; stage: string | null }) => void) =>
      new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          done = true;
          unsub();
          clearInterval(poll);
          resolve();
        };
        const handle = (status: string, progress: number, stage: string | null) => {
          if (done) return;
          onUpdate({ status, progress, stage });
          if (["succeeded", "failed", "cancelled"].includes(status)) finish();
        };
        const unsub = subscribe((ev) => {
          if (ev.type === "job.progress" && ev.job_id === jobId) handle(ev.status, ev.progress, ev.stage);
        });
        const poll = setInterval(async () => {
          try {
            const j = await api.job(jobId);
            handle(j.status, j.progress, j.stage);
          } catch {
            /* transient */
          }
        }, 2500);
        void api.job(jobId).then((j) => handle(j.status, j.progress, j.stage));
      }),
    [subscribe],
  );
}
