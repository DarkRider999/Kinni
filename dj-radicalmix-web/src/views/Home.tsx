import type { useEngine } from "../state/useEngine";

export function Home({ eng, onEnter }: { eng: ReturnType<typeof useEngine>; onEnter: () => void }) {
  return (
    <div className="hero">
      <div className="logo-ring">R</div>
      <div>
        <h1 style={{ margin: 0 }}>
          DJ <span className="neon-text">RadicalMix</span>
        </h1>
        <div className="tagline">SplitFire Production &middot; Mix Beyond Reality</div>
      </div>
      <p style={{ maxWidth: 480, color: "var(--ink-dim)", fontSize: 14 }}>
        A real two-deck DJ console running the DJ Nexus Pro C++ audio engine, compiled to WebAssembly, right
        here in your browser &mdash; plus a local track library with automatic BPM/key detection and the
        RadicalAI next-track advisor.
      </p>
      <button className="btn primary" onClick={onEnter} disabled={eng.status === "starting" || eng.status === "running"}>
        {eng.status === "starting" ? "Starting the engine..." : eng.status === "running" ? "Engine running" : "Enter the Booth"}
      </button>
      {eng.status === "failed" && <p style={{ color: "var(--bad)" }}>Could not start audio: {eng.error}</p>}
      <p style={{ maxWidth: 480, color: "var(--ink-dim)", fontSize: 11 }}>
        Browsers require a click before audio can start. Everything here runs locally in this tab &mdash; no
        account, no server, nothing uploaded.
      </p>
    </div>
  );
}
