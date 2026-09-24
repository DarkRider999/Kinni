import type { MediaKind, RecipeBody, Step } from "../api/types";

// Control schema drives the generic step editor used by both the Editor and the Batch recipe builder.
export type Control =
  | { kind: "slider"; key: string; label: string; min: number; max: number; step?: number; unit?: string }
  | { kind: "toggle"; key: string; label: string }
  | { kind: "segment"; key: string; label: string; options: { value: string | number; label: string }[] };

export interface OpMeta {
  op: string;
  label: string;
  panel: Panel;
  description: string;
  media: MediaKind[];
  defaults: Record<string, unknown>;
  controls: Control[];
}

export type Panel = "enhance" | "face" | "background" | "upscale" | "color" | "motion";

export const OPS: Record<string, OpMeta> = {
  enhance: {
    op: "enhance",
    label: "Auto Enhance",
    panel: "enhance",
    description: "Denoise, white balance, levels, clarity and sharpening, tuned to each file.",
    media: ["image", "video", "gif"],
    defaults: { auto: true, strength: 70, denoise: 30, sharpness: 40, clarity: 30, exposure: 0, contrast: 0, saturation: 0, white_balance: true },
    controls: [
      { kind: "toggle", key: "auto", label: "Auto (analyse & correct)" },
      { kind: "slider", key: "strength", label: "Strength", min: 0, max: 100 },
      { kind: "slider", key: "denoise", label: "Denoise", min: 0, max: 100 },
      { kind: "slider", key: "sharpness", label: "Sharpness", min: 0, max: 100 },
      { kind: "slider", key: "clarity", label: "Clarity", min: 0, max: 100 },
      { kind: "slider", key: "exposure", label: "Exposure", min: -2, max: 2, step: 0.1, unit: " EV" },
      { kind: "slider", key: "contrast", label: "Contrast", min: -100, max: 100 },
      { kind: "slider", key: "saturation", label: "Saturation", min: -100, max: 100 },
      { kind: "toggle", key: "white_balance", label: "Auto white balance" },
    ],
  },
  hdr: {
    op: "hdr",
    label: "HDR",
    panel: "enhance",
    description: "Recover highlights and lift shadows with exposure fusion.",
    media: ["image", "video", "gif"],
    defaults: { intensity: 60 },
    controls: [{ kind: "slider", key: "intensity", label: "Intensity", min: 0, max: 100 }],
  },
  upscale: {
    op: "upscale",
    label: "Upscale",
    panel: "upscale",
    description: "Super-resolution (Real-ESRGAN on GPU workers).",
    media: ["image", "video", "gif"],
    defaults: { scale: 2, model: "auto" },
    controls: [
      { kind: "segment", key: "scale", label: "Scale", options: [2, 4, 8].map((v) => ({ value: v, label: `${v}x` })) },
      {
        kind: "segment",
        key: "model",
        label: "Model",
        options: [
          { value: "auto", label: "Auto" },
          { value: "photo", label: "Photo" },
          { value: "anime", label: "Anime / Art" },
        ],
      },
    ],
  },
  color_grade: {
    op: "color_grade",
    label: "Color Grade",
    panel: "color",
    description: "Cinematic LUT looks, identical on every frame.",
    media: ["image", "video", "gif"],
    defaults: { lut: "cinematic_teal_orange", intensity: 0.7 },
    controls: [{ kind: "slider", key: "intensity", label: "Intensity", min: 0, max: 1, step: 0.05 }],
  },
  face_retouch: {
    op: "face_retouch",
    label: "Skin & Eyes",
    panel: "face",
    description: "Texture-preserving skin smoothing, blemish removal and eye enhancement.",
    media: ["image", "video", "gif"],
    defaults: { smooth: 35, blemish: true, eyes: 20, faces: "all" },
    controls: [
      { kind: "slider", key: "smooth", label: "Skin smoothing", min: 0, max: 100 },
      { kind: "toggle", key: "blemish", label: "Blemish removal (photos)" },
      { kind: "slider", key: "eyes", label: "Eye enhance", min: 0, max: 100 },
      {
        kind: "segment",
        key: "faces",
        label: "Apply to",
        options: [
          { value: "all", label: "All faces" },
          { value: "largest", label: "Main face" },
        ],
      },
    ],
  },
  face_restore: {
    op: "face_restore",
    label: "Face Restore",
    panel: "face",
    description: "Recover detail in soft, compressed or old portraits.",
    media: ["image", "video", "gif"],
    defaults: { fidelity: 0.7, faces: "all" },
    controls: [
      { kind: "slider", key: "fidelity", label: "Fidelity (identity ↔ quality)", min: 0, max: 1, step: 0.05 },
      {
        kind: "segment",
        key: "faces",
        label: "Apply to",
        options: [
          { value: "all", label: "All faces" },
          { value: "largest", label: "Main face" },
        ],
      },
    ],
  },
  background: {
    op: "background",
    label: "Background",
    panel: "background",
    description: "Remove, replace or blur the background.",
    media: ["image", "video", "gif"],
    defaults: { mode: "blur", fill: "transparent", color: "#FFFFFF", source: "preset", preset_id: "background.studio_white", image_file_id: null, aperture: 2.8, edge_refine: true },
    controls: [],
  },
  stabilize: {
    op: "stabilize",
    label: "Stabilize",
    panel: "motion",
    description: "Smooth shaky footage (video only).",
    media: ["video", "gif"],
    defaults: { strength: "standard", crop_pct: 8 },
    controls: [
      {
        kind: "segment",
        key: "strength",
        label: "Strength",
        options: [
          { value: "standard", label: "Standard" },
          { value: "strong", label: "Strong" },
          { value: "tripod", label: "Tripod lock" },
        ],
      },
      { kind: "slider", key: "crop_pct", label: "Border crop", min: 0, max: 20, unit: "%" },
    ],
  },
};

export const PANELS: { id: Panel | "swap" | "dress"; label: string; ops: string[]; planned?: boolean }[] = [
  { id: "enhance", label: "Enhance", ops: ["enhance", "hdr"] },
  { id: "face", label: "Face", ops: ["face_retouch", "face_restore"] },
  { id: "background", label: "Background", ops: ["background"] },
  { id: "upscale", label: "Upscale", ops: ["upscale"] },
  { id: "color", label: "Color", ops: ["color_grade"] },
  { id: "motion", label: "Motion", ops: ["stabilize"] },
  { id: "swap", label: "Face Swap", ops: [], planned: true },
  { id: "dress", label: "Dress Swap", ops: [], planned: true },
];

export function newStep(op: string): Step {
  const meta = OPS[op];
  return { op, params: { ...meta.defaults }, enabled: true };
}

/** Strip fields the backend rejects (it forbids unknown params) and drop disabled steps' noise. */
export function cleanStep(step: Step): Step {
  const meta = OPS[step.op];
  const params: Record<string, unknown> = {};
  for (const k of Object.keys(meta.defaults)) {
    const v = step.params[k];
    if (v !== undefined && v !== null) params[k] = v;
  }
  return { op: step.op, params, enabled: step.enabled ?? true };
}

export function buildRecipe(steps: Step[], output?: RecipeBody["output"]): RecipeBody {
  return { version: 1, steps: steps.map(cleanStep), output };
}

export function appliesTo(op: string, kind: MediaKind): boolean {
  return OPS[op]?.media.includes(kind) ?? false;
}

export function summarize(step: Step): string {
  const p = step.params;
  switch (step.op) {
    case "upscale":
      return `Upscale ${p.scale}x`;
    case "background":
      return `BG ${p.mode}`;
    case "color_grade":
      return `Grade · ${String(p.lut).replaceAll("_", " ")}`;
    case "stabilize":
      return `Stabilize · ${p.strength}`;
    default:
      return OPS[step.op]?.label ?? step.op;
  }
}

/** Home-screen quick actions: panel to open plus the exact step to seed. */
export const QUICK_ACTIONS: Record<string, { panel: Panel; step: Step }> = {
  enhance: { panel: "enhance", step: newStep("enhance") },
  upscale4: { panel: "upscale", step: { op: "upscale", params: { scale: 4, model: "auto" }, enabled: true } },
  remove_bg: { panel: "background", step: { ...newStep("background"), params: { ...OPS.background.defaults, mode: "remove" } } },
  blur_bg: { panel: "background", step: { ...newStep("background"), params: { ...OPS.background.defaults, mode: "blur" } } },
  retouch: { panel: "face", step: newStep("face_retouch") },
  grade: { panel: "color", step: newStep("color_grade") },
  stabilize: { panel: "motion", step: newStep("stabilize") },
};

export const RESOLUTIONS = [
  { value: "sd", label: "SD", px: 854 },
  { value: "hd", label: "HD", px: 1280 },
  { value: "fhd", label: "Full HD", px: 1920 },
  { value: "4k", label: "4K", px: 3840 },
  { value: "8k", label: "8K", px: 7680 },
  { value: "original", label: "Original", px: Infinity },
] as const;

const RES_ORDER = ["sd", "hd", "fhd", "4k", "8k"];

export function resolutionAllowed(res: string, planMax: string): boolean {
  return res === "original" || RES_ORDER.indexOf(res) <= RES_ORDER.indexOf(planMax);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-msvideo,.avi,.mov";
