// Web Worker for the engine's offline jobs, off the page's main thread and
// away from the audio thread:
//   {id, left, right, sampleRate, minBpm?, maxBpm?}          -> {id, result}: tempo, downbeat, key
//   {id, op: "separate", left, right, sampleRate}              -> {id, progress} ... {id, result}: stems
// Errors come back as {id, error}.
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
    if (m.op === "separate") {
      let last = 0;
      const stems = rt.separate(m.left, m.right, m.sampleRate, (p) => {
        if (p - last >= 0.01 || p >= 1) { last = p; postMessage({ id: m.id, progress: p }); }
        return false;
      });
      const transfer = [];
      for (const k of ["drums", "bass", "vocals"]) transfer.push(stems[k][0].buffer, stems[k][1].buffer);
      postMessage({ id: m.id, result: { stems, ms: performance.now() - t0, mode: rt.mode } }, transfer);
      return;
    }
    const result = rt.analyze(m.left, m.right, m.sampleRate, m.minBpm, m.maxBpm);
    result.ms = performance.now() - t0;
    result.mode = rt.mode;
    postMessage({ id: m.id, result });
  } catch (err) {
    postMessage({ id: m.id, error: String((err && err.message) || err) });
  }
};
