// Web Worker that analyses tracks (tempo, downbeat, key) with the engine's
// WebAssembly build, off the page's main thread and away from the audio thread.
//   post {id, left, right, sampleRate, minBpm?, maxBpm?} -> {id, result} or {id, error}
importScripts("djnexus-runtime.js");

let ready = null;

function init() {
  if (!ready) {
    ready = (async () => {
      const rt = new DJNexusRuntime();
      try {
        const r = await fetch("djnexus.wasm");
        if (!r.ok) throw new Error("no wasm");
        await rt.initWasm(await r.arrayBuffer(), 48000);
      } catch (e) {
        importScripts("djnexus-asm.js");  // WebAssembly blocked: plain JS build
        rt.initAsm(48000);
      }
      return rt;
    })();
  }
  return ready;
}

onmessage = async (e) => {
  const m = e.data;
  try {
    const rt = await init();
    const t0 = performance.now();
    const result = rt.analyze(m.left, m.right, m.sampleRate, m.minBpm, m.maxBpm);
    result.ms = performance.now() - t0;
    result.mode = rt.mode;
    postMessage({ id: m.id, result });
  } catch (err) {
    postMessage({ id: m.id, error: String((err && err.message) || err) });
  }
};
