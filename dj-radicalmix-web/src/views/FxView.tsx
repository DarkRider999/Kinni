import { useState } from "react";
import { engine } from "../engine/engineBridge";
import { FX_TARGET_MASTER, Macro } from "../engine/types";
import type { useEngine } from "../state/useEngine";

const FX_TYPE_NAMES = ["Echo", "Delay", "Ping-Pong", "Reverb", "Flanger", "Phaser", "Roll", "Stutter", "Trans", "Pitch", "Distortion", "Crush"];
const COLOR_NAMES = ["Filter", "Noise", "Dub Echo", "Pitch", "Crush", "Space"];
const TARGETS: { label: string; value: number }[] = [
  { label: "Deck A", value: 0 },
  { label: "Deck B", value: 1 },
  { label: "Master", value: FX_TARGET_MASTER },
];

function FxUnit({ unit }: { unit: 0 | 1 }) {
  const [on, setOn] = useState(false);
  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        FX {unit + 1}
        <button
          className={`btn small togglebtn${on ? " on" : ""}`}
          style={{ float: "right" }}
          onClick={() => {
            const next = !on;
            setOn(next);
            engine.call("djn_fx_set_on", unit, next ? 1 : 0);
          }}
        >
          {on ? "On" : "Off"}
        </button>
      </h3>
      <div className="row">
        <label>Type</label>
        <select className="field" style={{ flex: 1 }} onChange={(e) => engine.call("djn_fx_set_type", unit, parseInt(e.target.value, 10))}>
          {FX_TYPE_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <label>Target</label>
        <select className="field" style={{ flex: 1 }} onChange={(e) => engine.call("djn_fx_set_target", unit, parseInt(e.target.value, 10))}>
          {TARGETS.map((t) => (
            <option key={t.label} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <label>Beats</label>
        <input type="range" min={0.0625} max={16} step={0.0625} defaultValue={1} onChange={(e) => engine.call("djn_fx_set_beats", unit, parseFloat(e.target.value))} />
      </div>
      <div className="row">
        <label>Depth</label>
        <input type="range" min={0} max={1} step={0.01} defaultValue={0.5} onChange={(e) => engine.call("djn_fx_set_depth", unit, parseFloat(e.target.value))} />
      </div>
      <div className="row">
        <label>Wet</label>
        <input type="range" min={0} max={1} step={0.01} defaultValue={0.5} onChange={(e) => engine.call("djn_fx_set_wet", unit, parseFloat(e.target.value))} />
      </div>
    </div>
  );
}

function ColorFxPanel() {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Colour FX (master)</h3>
      <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: -6 }}>
        Played by each deck's "Filter" knob on the Decks screen -- pick the flavour here, dial it in there.
      </p>
      <div className="row">
        <label>Type</label>
        <select className="field" style={{ flex: 1 }} onChange={(e) => engine.call("djn_mixer_set_color_fx", parseInt(e.target.value, 10))}>
          {COLOR_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <label>Colour param</label>
        <input type="range" min={0} max={1} step={0.01} defaultValue={0.5} onChange={(e) => engine.call("djn_mixer_set_color_param", parseFloat(e.target.value))} />
      </div>
    </div>
  );
}

function MacrosPanel({ eng }: { eng: ReturnType<typeof useEngine> }) {
  const [bars, setBars] = useState(4);
  const [target, setTarget] = useState<number>(FX_TARGET_MASTER);
  const [impact, setImpact] = useState(true);
  const running = eng.state?.macro ?? -1;
  const macroName = ["Riser", "Build-up", "Drop"][running] ?? null;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Performance macros</h3>
      <div className="row">
        <label>Bars</label>
        <input type="range" min={1} max={16} step={1} value={bars} onChange={(e) => setBars(parseInt(e.target.value, 10))} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{bars}</span>
      </div>
      <div className="row">
        <label>Target</label>
        <select className="field" style={{ flex: 1 }} value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10))}>
          {TARGETS.map((t) => (
            <option key={t.label} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 10 }}>
        <input type="checkbox" checked={impact} onChange={(e) => setImpact(e.target.checked)} /> Impact on drop
      </label>
      <div className="transport">
        <button className="btn" onClick={() => engine.call("djn_macro_start", Macro.RISER, bars, target, impact ? 1 : 0)}>
          Riser
        </button>
        <button className="btn" onClick={() => engine.call("djn_macro_start", Macro.BUILD_UP, bars, target, impact ? 1 : 0)}>
          Build-up
        </button>
        <button className="btn" onClick={() => engine.call("djn_macro_start", Macro.DROP, bars, target, impact ? 1 : 0)}>
          Drop
        </button>
        <button className="btn ghost" onClick={() => engine.call("djn_macro_cancel")}>
          Cancel
        </button>
      </div>
      {macroName && (
        <div style={{ fontSize: 12, color: "var(--blue)" }}>
          Running: {macroName} ({((eng.state?.macroProgress ?? 0) * 100).toFixed(0)}%)
        </div>
      )}
    </div>
  );
}

export function FxView({ eng }: { eng: ReturnType<typeof useEngine> }) {
  return (
    <div className="grid2">
      <FxUnit unit={0} />
      <FxUnit unit={1} />
      <ColorFxPanel />
      <MacrosPanel eng={eng} />
    </div>
  );
}

