import {
  ArrowLeft,
  Crop,
  Eye,
  EyeOff,
  ImageUp,
  Palette,
  Plus,
  Save,
  ScanFace,
  Shirt,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { MediaFile, Step } from "../api/types";
import { CompareImage } from "../components/Compare";
import { ExportDialog } from "../components/ExportDialog";
import { StepEditor } from "../components/StepEditor";
import { CreditRing, ProgressBar, Toggle } from "../components/ui";
import { useApp, useJobWatcher } from "../lib/app-state";
import { appliesTo, buildRecipe, newStep, OPS, PANELS, QUICK_ACTIONS, summarize, type Panel } from "../lib/recipe";

const PANEL_ICONS = {
  enhance: Sparkles,
  face: Users,
  background: Crop,
  upscale: ImageUp,
  color: Palette,
  motion: Wand2,
  swap: ScanFace,
  dress: Shirt,
} as const;

type PanelId = Panel | "swap" | "dress";
const PREVIEW_DEBOUNCE_MS = 700;

export function Editor() {
  const { fileId = "" } = useParams();
  const [search] = useSearchParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const watch = useJobWatcher();
  const [file, setFile] = useState<MediaFile | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const quick = QUICK_ACTIONS[search.get("tool") ?? ""];
  const [panel, setPanel] = useState<PanelId>(quick?.panel ?? "enhance");
  const [preview, setPreview] = useState<{ url: string; mime: string } | null>(null);
  const [previewState, setPreviewState] = useState<{ status: string; progress: number; stage: string | null } | null>(null);
  const [showFaces, setShowFaces] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<"after" | "before">("after");
  const videoRef = useRef<HTMLVideoElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    api
      .file(fileId)
      .then(setFile)
      .catch(() => nav("/"));
  }, [fileId, nav]);

  // Quick action from Home seeds the matching step.
  useEffect(() => {
    if (quick && !steps.length) setSteps([structuredClone(quick.step)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPreview = useCallback(async () => {
    if (!file) return;
    const active = steps.filter((s) => s.enabled !== false && appliesTo(s.op, file.kind));
    if (!active.length) {
      setPreview(null);
      setPreviewState(null);
      return;
    }
    const mySeq = ++seq.current;
    try {
      const at = file.kind === "video" ? Math.round((videoRef.current?.currentTime ?? 0) * 1000) : 0;
      const job = await api.preview(file.id, buildRecipe(steps), at);
      await watch(job.id, (u) => mySeq === seq.current && setPreviewState(u));
      if (mySeq !== seq.current) return;
      const final = await api.job(job.id);
      if (final.status === "succeeded" && final.outputs?.[0]) {
        setPreview({ url: final.outputs[0].url, mime: final.outputs[0].mime_type });
        setView("after");
      } else if (final.error) toast(final.error.message, "error");
    } catch (e) {
      if (mySeq === seq.current) {
        setPreviewState(null);
        toast(e instanceof ApiError ? e.message : "Preview failed", "error");
      }
    }
  }, [file, steps, watch, toast]);

  useEffect(() => {
    const t = setTimeout(runPreview, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [runPreview]);

  if (!file) return <div className="muted">Loading…</div>;

  const updateStep = (i: number, s: Step) => setSteps((xs) => xs.map((x, j) => (j === i ? s : x)));
  const removeStep = (i: number) => setSteps((xs) => xs.filter((_, j) => j !== i));
  const addOp = (op: string) => setSteps((xs) => [...xs, newStep(op)]);
  const panelDef = PANELS.find((p) => p.id === panel)!;
  const busy = previewState && !["succeeded", "failed", "cancelled"].includes(previewState.status);

  const saveRecipe = async () => {
    const name = window.prompt("Recipe name", steps.map(summarize).join(" + "));
    if (!name) return;
    await api.saveRecipe(name, buildRecipe(steps));
    toast("Recipe saved", "success");
  };

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="btn ghost icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.original_name}</h2>
          <div className="small muted mono">
            {file.width}×{file.height}
            {file.duration_ms ? ` · ${(file.duration_ms / 1000).toFixed(1)}s` : ""}
            {file.analysis ? ` · ${file.analysis.face_count} face${file.analysis.face_count === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        <span className="spacer" />
        <CreditRing />
        <button className="btn" onClick={saveRecipe} disabled={!steps.length}>
          <Save size={16} /> Save recipe
        </button>
        <button className="btn primary" onClick={() => setExporting(true)} disabled={!steps.length} data-testid="export">
          Export ▶
        </button>
      </div>

      <div className="tool-rail" role="tablist" aria-label="Tools">
        {PANELS.map((p) => {
          const Icon = PANEL_ICONS[p.id];
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={panel === p.id}
              className={`${panel === p.id ? "on" : ""} ${p.planned ? "planned" : ""}`}
              onClick={() => setPanel(p.id)}
            >
              <Icon size={20} />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="canvas-wrap">
        <div className="status">
          {busy && (
            <span className="badge" style={{ background: "rgba(0,0,0,.7)" }} data-testid="preview-status">
              {previewState?.stage ?? "Queued"} · {Math.round((previewState?.progress ?? 0) * 100)}%
            </span>
          )}
          {file.kind === "image" && (file.analysis?.face_count ?? 0) > 0 && (
            <button className="btn sm" onClick={() => setShowFaces((v) => !v)}>
              {showFaces ? <EyeOff size={14} /> : <Eye size={14} />} Faces
            </button>
          )}
          {file.kind !== "image" && preview && (
            <div className="seg">
              <button className={view === "before" ? "on" : ""} onClick={() => setView("before")}>
                Original
              </button>
              <button className={view === "after" ? "on" : ""} onClick={() => setView("after")}>
                Preview
              </button>
            </div>
          )}
        </div>
        {file.kind === "image" ? (
          <CompareImage
            before={file.url}
            after={preview?.url}
            faces={showFaces ? file.analysis?.faces : undefined}
            srcWidth={file.width}
          />
        ) : view === "after" && preview ? (
          preview.mime.startsWith("video/") ? (
            <video key={preview.url} src={preview.url} controls autoPlay loop muted className="compare" data-testid="preview-video" />
          ) : (
            <img src={preview.url} alt="Preview" className="compare" data-testid="preview-image" />
          )
        ) : file.kind === "gif" ? (
          <img src={file.url} alt="Original" className="compare" />
        ) : (
          <video ref={videoRef} src={file.url} controls muted className="compare" />
        )}
      </div>

      <aside className="side-panel glass" aria-label={`${panelDef.label} panel`}>
        <h2>{panelDef.label}</h2>
        {panelDef.planned ? (
          <PlannedPanel id={panelDef.id} />
        ) : (
          panelDef.ops.map((op) => {
            const idx = steps.findIndex((s) => s.op === op);
            const meta = OPS[op];
            if (!appliesTo(op, file.kind))
              return (
                <p key={op} className="small muted">
                  {meta.label} applies to videos only.
                </p>
              );
            if (idx < 0)
              return (
                <button key={op} className="btn" onClick={() => addOp(op)} data-testid={`add-${op}`}>
                  <Plus size={16} /> Add {meta.label}
                </button>
              );
            const s = steps[idx];
            return (
              <div key={op} className="card stack">
                <div className="row">
                  <b>{meta.label}</b>
                  <span className="spacer" />
                  <Toggle label="" checked={s.enabled !== false} onChange={(v) => updateStep(idx, { ...s, enabled: v })} />
                  <button className="btn ghost icon-btn sm" onClick={() => removeStep(idx)} aria-label={`Remove ${meta.label}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <StepEditor step={s} onChange={(n) => updateStep(idx, n)} />
              </div>
            );
          })
        )}
      </aside>

      <div className="stack-bar" aria-label="Edit stack">
        <span className="small muted">Edit stack</span>
        {steps.length === 0 && <span className="small muted">— add a tool from the side panel</span>}
        {steps.map((s, i) => (
          <span key={`${s.op}-${i}`} className={`stack-item ${s.enabled === false ? "off" : ""}`}>
            <button onClick={() => setPanel(OPS[s.op].panel)}>{summarize(s)}</button>
            <button
              onClick={() => updateStep(i, { ...s, enabled: s.enabled === false })}
              aria-label={s.enabled === false ? "Enable step" : "Disable step"}
            >
              {s.enabled === false ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => removeStep(i)} aria-label="Remove step">
              <Trash2 size={14} />
            </button>
          </span>
        ))}
        <span className="spacer" />
        {busy && (
          <div style={{ width: 160 }}>
            <ProgressBar value={previewState?.progress ?? 0} status="running" />
          </div>
        )}
      </div>

      {exporting && <ExportDialog file={file} steps={steps} onClose={() => setExporting(false)} />}
    </div>
  );
}

function PlannedPanel({ id }: { id: string }) {
  if (id === "swap")
    return (
      <div className="planned-card stack">
        <b>Face Swap: coming in milestone M4</b>
        <p className="small muted" style={{ margin: 0 }}>
          Image→image, image→video and video→video swaps with identity locked across frames. To prevent deepfake abuse,
          source faces must be your own (selfie liveness check) or someone who approved it through an in-app consent link.
          Outputs are labeled as AI-edited.
        </p>
      </div>
    );
  return (
    <div className="planned-card stack">
      <b>Dress Swap: coming in milestone M5</b>
      <p className="small muted" style={{ margin: 0 }}>
        Formal, casual, party, wedding and traditional outfits (saree, sherwani, kimono, hanbok…) or your own garment photo,
        with lighting and body proportions preserved. Runs on GPU diffusion workers; outfits can't be made more revealing
        than swimwear.
      </p>
    </div>
  );
}
