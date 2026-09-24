import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { MediaFile, Preset, Step } from "../api/types";
import { useApp } from "../lib/app-state";
import { OPS } from "../lib/recipe";
import { Segmented, Slider, Toggle } from "./ui";

let presetCache: Preset[] | null = null;

export function usePresets(): Preset[] {
  const [presets, setPresets] = useState<Preset[]>(presetCache ?? []);
  useEffect(() => {
    if (presetCache) return;
    api.presets().then((r) => {
      presetCache = r.items;
      setPresets(r.items);
    });
  }, []);
  return presets;
}

export function presetCss(p: Preset): string {
  const c = p.payload.colors ?? ["#333"];
  if (p.payload.kind === "radial") return `radial-gradient(circle at 50% 42%, ${c.join(", ")})`;
  if (p.payload.kind === "linear") return `linear-gradient(${p.payload.angle ?? 180}deg, ${c.join(", ")})`;
  return c[0];
}

export function StepEditor({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const meta = OPS[step.op];
  const set = (k: string, v: unknown) => onChange({ ...step, params: { ...step.params, [k]: v } });
  const { me } = useApp();
  const p = step.params;
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        {meta.description}
      </p>
      {step.op === "color_grade" && <LutPicker value={String(p.lut)} onChange={(v) => set("lut", v)} />}
      {step.op === "background" && <BackgroundControls step={step} onChange={onChange} />}
      {meta.controls.map((c) => {
        if (c.kind === "slider")
          return (
            <Slider
              key={c.key}
              label={c.label}
              min={c.min}
              max={c.max}
              step={c.step}
              unit={c.unit}
              value={Number(p[c.key] ?? 0)}
              onChange={(v) => set(c.key, v)}
            />
          );
        if (c.kind === "toggle")
          return <Toggle key={c.key} label={c.label} checked={Boolean(p[c.key])} onChange={(v) => set(c.key, v)} />;
        return (
          <Segmented
            key={c.key}
            label={c.label}
            value={p[c.key] as string | number}
            options={c.options.map((o) => ({
              ...o,
              disabled: step.op === "upscale" && c.key === "scale" && me ? Number(o.value) > me.plan.max_upscale : false,
              title:
                step.op === "upscale" && c.key === "scale" && me && Number(o.value) > me.plan.max_upscale
                  ? "Upgrade your plan for this scale"
                  : undefined,
            }))}
            onChange={(v) => set(c.key, v)}
          />
        );
      })}
    </div>
  );
}

function LutPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const presets = usePresets().filter((p) => p.category === "lut");
  const swatch: Record<string, string> = {
    cinematic_teal_orange: "linear-gradient(135deg,#0b5563,#f28c38)",
    film: "linear-gradient(135deg,#6b6356,#d8c7a3)",
    noir: "linear-gradient(135deg,#111,#ddd)",
    vivid: "linear-gradient(135deg,#ff2b6d,#ffd400,#00c2ff)",
    warm: "linear-gradient(135deg,#ff9a3c,#ffe0a3)",
    cool: "linear-gradient(135deg,#1c5c9c,#b8e3ff)",
    neon: "linear-gradient(135deg,#ff2bd6,#00f0ff)",
  };
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
      {presets.map((p) => {
        const id = String(p.payload.lut);
        return (
          <button
            key={p.id}
            type="button"
            className={`chip ${value === id ? "on" : ""}`}
            style={{ height: "auto", padding: 6, flexDirection: "column", borderRadius: 12 }}
            onClick={() => onChange(id)}
            aria-pressed={value === id}
          >
            <span style={{ width: "100%", height: 36, borderRadius: 8, background: swatch[id] ?? "#333" }} />
            <span className="small">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function BackgroundControls({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const p = step.params;
  const set = (patch: Record<string, unknown>) => onChange({ ...step, params: { ...p, ...patch } });
  const presets = usePresets().filter((x) => x.category === "background");
  const [images, setImages] = useState<MediaFile[]>([]);
  useEffect(() => {
    if (p.mode === "replace" && p.source === "upload") api.files("image").then((r) => setImages(r.items));
  }, [p.mode, p.source]);
  return (
    <div className="stack">
      <Segmented
        label="Mode"
        value={String(p.mode)}
        options={[
          { value: "remove", label: "Remove" },
          { value: "replace", label: "Replace" },
          { value: "blur", label: "Blur (bokeh)" },
        ]}
        onChange={(mode) => set({ mode })}
      />
      {p.mode === "remove" && (
        <>
          <Segmented
            label="Fill"
            value={String(p.fill)}
            options={[
              { value: "transparent", label: "Transparent" },
              { value: "white", label: "White" },
              { value: "color", label: "Color" },
            ]}
            onChange={(fill) => set({ fill })}
          />
          {p.fill === "color" && (
            <label className="row">
              <span className="small muted">Fill color</span>
              <input type="color" value={String(p.color)} onChange={(e) => set({ color: e.target.value.toUpperCase() })} />
            </label>
          )}
          {p.fill === "transparent" && <p className="small muted">Export as PNG or WEBP to keep transparency.</p>}
        </>
      )}
      {p.mode === "replace" && (
        <>
          <Segmented
            label="Source"
            value={String(p.source)}
            options={[
              { value: "preset", label: "Library" },
              { value: "upload", label: "My image" },
              { value: "color", label: "Color" },
            ]}
            onChange={(source) => set({ source })}
          />
          {p.source === "preset" && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              {presets.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  title={bg.name}
                  aria-label={bg.name}
                  aria-pressed={p.preset_id === bg.id}
                  onClick={() => set({ preset_id: bg.id })}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 10,
                    cursor: "pointer",
                    background: presetCss(bg),
                    border: p.preset_id === bg.id ? "2px solid var(--cyan)" : "1px solid var(--border-strong)",
                    boxShadow: p.preset_id === bg.id ? "var(--glow)" : undefined,
                  }}
                />
              ))}
            </div>
          )}
          {p.source === "upload" && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {images.length === 0 && <p className="small muted">Upload a background photo first.</p>}
              {images.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`thumb ${p.image_file_id === f.id ? "selected" : ""}`}
                  onClick={() => set({ image_file_id: f.id })}
                  aria-label={f.original_name}
                >
                  {f.thumb_url && <img src={f.thumb_url} alt="" />}
                </button>
              ))}
            </div>
          )}
          {p.source === "color" && (
            <label className="row">
              <span className="small muted">Color</span>
              <input type="color" value={String(p.color)} onChange={(e) => set({ color: e.target.value.toUpperCase() })} />
            </label>
          )}
          <p className="small muted">AI-generated backgrounds from a prompt arrive with the GPU generative milestone.</p>
        </>
      )}
      {p.mode === "blur" && (
        <Slider
          label="Aperture (lower = more blur)"
          min={1}
          max={16}
          step={0.1}
          unit=""
          value={Number(p.aperture)}
          onChange={(aperture) => set({ aperture })}
        />
      )}
      <Toggle label="Refine edges (hair detail)" checked={Boolean(p.edge_refine)} onChange={(edge_refine) => set({ edge_refine })} />
    </div>
  );
}
