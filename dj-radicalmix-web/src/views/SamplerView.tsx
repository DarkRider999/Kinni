import { useEffect, useState } from "react";
import { engine } from "../engine/engineBridge";
import { STARTER_SOUNDS, toStereo } from "../lib/starterSounds";

export function SamplerView() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let slot = 0; slot < STARTER_SOUNDS.length; slot++) {
        const mono = STARTER_SOUNDS[slot].generate(engine.sampleRate);
        const [left, right] = toStereo(mono);
        await engine.loadSample(slot, left, right, 0);
        engine.call("djn_sampler_set_mode", slot, 0); // one-shot
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p style={{ color: "var(--ink-dim)", fontSize: 13, maxWidth: 640 }}>
        Starter pack: 8 procedurally synthesized one-shots (no licensed content shipped in this build -- see{" "}
        <code>src/lib/starterSounds.ts</code>). These run through the engine's real sampler voice allocator,
        choke groups and quantize, the same as any sample pack would.
      </p>
      <div className="pads">
        {STARTER_SOUNDS.map((s, slot) => (
          <button
            key={s.name}
            className="pad"
            style={{ borderColor: s.color, opacity: ready ? 1 : 0.5 }}
            disabled={!ready}
            onMouseDown={() => engine.call("djn_sampler_trigger", slot, 1.0)}
            onMouseUp={() => engine.call("djn_sampler_release", slot)}
            onTouchStart={(e) => {
              e.preventDefault();
              engine.call("djn_sampler_trigger", slot, 1.0);
            }}
            onTouchEnd={() => engine.call("djn_sampler_release", slot)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => engine.call("djn_sampler_stop_all")}>
          Stop all
        </button>
      </div>
    </div>
  );
}
