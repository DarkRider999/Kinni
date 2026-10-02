// Bridge to the real DJ Nexus Pro C++ audio engine, compiled to WebAssembly
// (dj-nexus-pro/engine/web/djnexus.wasm). Runs it on the audio thread via an
// AudioWorklet when available, falling back to a ScriptProcessorNode on the
// main thread, and finally to a plain-JS build of the engine (djnexus-asm.js)
// where WebAssembly itself is unavailable.
//
// This mirrors the proven bootstrap in dj-nexus-pro/engine/web/index.html
// (the "Deck Lab" demo) rather than re-deriving the AudioWorklet wiring from
// scratch -- that demo's engine bridge is already real, working code.
import type { EngineState } from "./types";

// djnexus-runtime.js is loaded as a classic script and sets this global.
declare global {
  interface Window {
    DJNexusRuntime: new () => RuntimeInstance;
  }
}

interface RuntimeInstance {
  mode: string;
  call(fn: string, args?: unknown[]): unknown;
  load(deck: number, left: Float32Array, right: Float32Array, sampleRate: number, bpm: number, firstBeat: number): number;
  loadSample(slot: number, left: Float32Array, right: Float32Array, sampleRate: number, bpm: number): number;
  render(outL: Float32Array, outR: Float32Array, frames: number): void;
  state(out?: Float64Array): Float64Array;
  initWasm(bytes: ArrayBuffer, sampleRate: number): Promise<void>;
  initAsm(sampleRate: number): void;
}

type RuntimeStatic = { unpack(a: Float64Array): EngineState };

const ENGINE_BASE = "/engine/";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(s);
  });
}

export type EngineMode = "" | "WebAssembly" | "JavaScript";
export type EngineThread = "" | "audio thread" | "main thread";

class EngineBridge {
  ctx: AudioContext | null = null;
  node: AudioWorkletNode | null = null;
  rt: RuntimeInstance | null = null;
  mode: EngineMode = "";
  thread: EngineThread = "";
  state: EngineState | null = null;
  dspLoad = 0;
  sampleRate = 48000;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private waitReady: ((m: { type: string }) => void) | null = null;
  private onState: ((s: EngineState) => void) | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private sp: ScriptProcessorNode | null = null;

  subscribe(fn: (s: EngineState) => void) {
    this.onState = fn;
  }

  async start(): Promise<void> {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx({ latencyHint: "interactive" });
    this.ctx = ctx;
    await ctx.resume();
    this.sampleRate = ctx.sampleRate;

    // Needed on the main thread too (not just inside the AudioWorklet, which
    // gets its own copy via addModule below): DJNexusRuntime.unpack() reads
    // worklet state messages here, and the ScriptProcessor fallback path runs
    // a whole runtime instance directly on the main thread.
    if (!window.DJNexusRuntime) await loadScript(`${ENGINE_BASE}djnexus-runtime.js`);

    let bytes: ArrayBuffer | null = null;
    try {
      const r = await fetch(`${ENGINE_BASE}djnexus.wasm`);
      if (r.ok) bytes = await r.arrayBuffer();
    } catch {
      bytes = null;
    }

    if (ctx.audioWorklet && window.AudioWorkletNode) {
      try {
        await ctx.audioWorklet.addModule(`${ENGINE_BASE}djnexus-runtime.js`);
        await ctx.audioWorklet.addModule(`${ENGINE_BASE}djnexus-worklet.js`);
        const node = new AudioWorkletNode(ctx, "djnexus", { numberOfInputs: 0, outputChannelCount: [2] });
        node.port.onmessage = (e) => this.onMessage(e.data);
        node.connect(ctx.destination);
        this.node = node;

        type ReadyMsg = { type: string; mode?: EngineMode };
        let ready: ReadyMsg | null = null;
        if (bytes) ready = (await this.handshake({ type: "init-wasm", bytes: bytes.slice(0) })) as ReadyMsg | null;
        if (!ready) {
          await ctx.audioWorklet.addModule(`${ENGINE_BASE}djnexus-asm.js`);
          ready = (await this.handshake({ type: "init-asm" })) as ReadyMsg | null;
        }
        if (ready) {
          this.mode = ready.mode ?? "";
          this.thread = "audio thread";
          return;
        }
        node.disconnect();
        this.node = null;
      } catch (e) {
        console.warn("AudioWorklet unavailable, falling back to the main thread", e);
        if (this.node) {
          this.node.disconnect();
          this.node = null;
        }
      }
    }

    // Fallback: run the engine on the main thread with a ScriptProcessorNode.
    const rt = new window.DJNexusRuntime();
    let ok = false;
    if (bytes) {
      try {
        await rt.initWasm(bytes, ctx.sampleRate);
        ok = true;
      } catch (e) {
        console.warn(e);
      }
    }
    if (!ok) {
      await loadScript(`${ENGINE_BASE}djnexus-asm.js`);
      rt.initAsm(ctx.sampleRate);
    }
    this.rt = rt;
    this.mode = rt.mode as EngineMode;
    this.thread = "main thread";
    const sp = ctx.createScriptProcessor(1024, 0, 2);
    let busy = 0;
    let windowStart = performance.now();
    sp.onaudioprocess = (ev) => {
      const t0 = performance.now();
      const o = ev.outputBuffer;
      rt.render(o.getChannelData(0), o.getChannelData(1), o.length);
      busy += performance.now() - t0;
      const now = performance.now();
      if (now - windowStart > 1000) {
        this.dspLoad = busy / (now - windowStart);
        busy = 0;
        windowStart = now;
      }
      this.poll();
    };
    sp.connect(ctx.destination);
    this.sp = sp;
  }

  private handshake(msg: Record<string, unknown>): Promise<{ type: string } | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waitReady = null;
        resolve(null);
      }, 8000);
      this.waitReady = (m) => {
        clearTimeout(timer);
        this.waitReady = null;
        resolve(m.type === "ready" ? m : null);
      };
      this.node!.port.postMessage(msg);
    });
  }

  private onMessage(m: Record<string, unknown>) {
    const RuntimeCtor = window.DJNexusRuntime as unknown as RuntimeStatic;
    if (m.type === "state") {
      this.state = RuntimeCtor.unpack(m.state as Float64Array);
      this.dspLoad = m.dspLoad as number;
      if (this.onState) this.onState(this.state);
    } else if ((m.type === "ready" || (m.type === "error" && (m.stage === "init-wasm" || m.stage === "init-asm"))) && this.waitReady) {
      if (m.type === "error") console.warn("engine init failed:", m.message);
      this.waitReady(m as { type: string });
    } else if (m.type === "result" || m.type === "error") {
      const p = this.pending.get(m.id as number);
      if (p) {
        this.pending.delete(m.id as number);
        if (m.type === "error") p.reject(new Error(m.message as string));
        else p.resolve(m.result);
      } else if (m.type === "error") {
        console.warn("engine:", m.message);
      }
    }
  }

  /** Fire-and-forget call into any exported djn_* function (engine handle is implicit). */
  call(fn: string, ...args: unknown[]): void {
    if (this.node) this.node.port.postMessage({ type: "call", fn, args });
    else if (this.rt) this.rt.call(fn, args);
  }

  load(deck: number, left: Float32Array, right: Float32Array, bpm: number, firstBeat: number): Promise<number> {
    if (this.rt) return Promise.resolve(this.rt.load(deck, left, right, this.sampleRate, bpm, firstBeat));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.node!.port.postMessage(
        { type: "load", id, deck, left, right, sampleRate: this.sampleRate, bpm, firstBeat },
        [left.buffer, right.buffer],
      );
    });
  }

  loadSample(slot: number, left: Float32Array, right: Float32Array, bpm: number): Promise<number> {
    if (this.rt) return Promise.resolve(this.rt.loadSample(slot, left, right, this.sampleRate, bpm));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.node!.port.postMessage(
        { type: "loadSample", id, slot, left, right, sampleRate: this.sampleRate, bpm },
        [left.buffer, right.buffer],
      );
    });
  }

  poll(): EngineState | null {
    if (this.rt) {
      const RuntimeCtor = window.DJNexusRuntime as unknown as RuntimeStatic;
      this.state = RuntimeCtor.unpack(this.rt.state());
      if (this.onState) this.onState(this.state);
    }
    return this.state;
  }

  /** Taps the engine's output into a MediaStream for MediaRecorder, in addition to speakers. */
  startRecordTap(): MediaStream {
    if (!this.ctx) throw new Error("engine not started");
    if (!this.recordDest) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      (this.node ?? this.sp)?.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }
}

export const engine = new EngineBridge();
// Exposed for debugging from the browser console / e2e scripts.
(window as unknown as { __djEngine: EngineBridge }).__djEngine = engine;
