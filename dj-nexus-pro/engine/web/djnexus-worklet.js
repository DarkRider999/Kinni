// AudioWorklet processor that runs the DJ Nexus engine on the browser's audio
// thread. Load djnexus-runtime.js into the worklet first (and djnexus-asm.js
// when WebAssembly is unavailable).
class DJNexusProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rt = null;
    this.blocks = 0;
    this.busyMs = 0;
    this.windowStart = Date.now();
    this.dspLoad = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  async onMessage(m) {
    try {
      if (m.type === "init-wasm" || m.type === "init-asm") {
        const rt = new globalThis.DJNexusRuntime();
        if (m.type === "init-wasm") await rt.initWasm(m.bytes, sampleRate);
        else rt.initAsm(sampleRate);
        this.rt = rt;
        this.port.postMessage({ type: "ready", mode: rt.mode, sampleRate });
        return;
      }
      if (!this.rt) return;
      if (m.type === "call") {
        const result = this.rt.call(m.fn, m.args);
        if (m.id) this.port.postMessage({ type: "result", id: m.id, result });
      } else if (m.type === "load") {
        const result = this.rt.load(m.deck, m.left, m.right, m.sampleRate, m.bpm, m.firstBeat);
        this.port.postMessage({ type: "result", id: m.id, result });
      }
    } catch (err) {
      this.port.postMessage({ type: "error", stage: m.type, id: m.id, message: String(err && err.message || err) });
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const left = out[0];
    const right = out[1] || out[0];
    if (!this.rt) {
      left.fill(0);
      right.fill(0);
      return true;
    }
    const t0 = Date.now();
    this.rt.render(left, right, left.length);
    this.busyMs += Date.now() - t0;

    // DSP load averaged over 1 s windows (Date.now() is coarse per block).
    const now = Date.now();
    if (now - this.windowStart >= 1000) {
      this.dspLoad = this.busyMs / (now - this.windowStart);
      this.busyMs = 0;
      this.windowStart = now;
    }
    if (++this.blocks % 6 === 0) {
      const s = this.rt.state();
      this.port.postMessage({ type: "state", state: s, time: currentTime, dspLoad: this.dspLoad });
    }
    return true;
  }
}

registerProcessor("djnexus", DJNexusProcessor);
