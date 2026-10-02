import { useCallback, useEffect, useRef, useState } from "react";
import { engine, type EngineMode, type EngineThread } from "../engine/engineBridge";
import type { EngineState } from "../engine/types";

export type EngineStatus = "idle" | "starting" | "running" | "failed";

export function useEngine() {
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [mode, setMode] = useState<EngineMode>("");
  const [thread, setThread] = useState<EngineThread>("");
  const [state, setState] = useState<EngineState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    engine.subscribe((s) => setState(s));
  }, []);

  const enter = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setStatus("starting");
    try {
      await engine.start();
      setMode(engine.mode);
      setThread(engine.thread);
      setStatus("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("failed");
      started.current = false;
    }
  }, []);

  // Main-thread (ScriptProcessor) fallback doesn't push state; poll it instead.
  useEffect(() => {
    if (status !== "running" || thread !== "main thread") return;
    const id = setInterval(() => engine.poll(), 100);
    return () => clearInterval(id);
  }, [status, thread]);

  return { status, mode, thread, state, error, enter };
}
