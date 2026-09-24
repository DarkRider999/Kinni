import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { MediaFile, OutputSpec, SavedRecipe, Step } from "../api/types";
import { StepEditor } from "../components/StepEditor";
import { KindBadge, Segmented } from "../components/ui";
import { useApp } from "../lib/app-state";
import { buildRecipe, newStep, OPS, RESOLUTIONS, resolutionAllowed, summarize } from "../lib/recipe";

export function BatchNew() {
  const [search] = useSearchParams();
  const nav = useNavigate();
  const { me, toast } = useApp();
  const ids = useMemo(() => (search.get("files") ?? "").split(",").filter(Boolean), [search]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [steps, setSteps] = useState<Step[]>([newStep("enhance")]);
  const [open, setOpen] = useState(0);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [output, setOutput] = useState<OutputSpec>({
    image_format: "jpg",
    video_format: "mp4",
    resolution: "original",
    quality: "balanced",
    strip_metadata: true,
    gif_fps: 15,
  });
  const [estimate, setEstimate] = useState<{ total_credits: number; affordable: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all(ids.map((id) => api.file(id).catch(() => null))).then((fs) => setFiles(fs.filter(Boolean) as MediaFile[]));
    api.recipes().then((r) => setSaved(r.items));
  }, [ids]);

  const recipe = buildRecipe(steps, output);
  const recipeKey = JSON.stringify(recipe);
  useEffect(() => {
    if (!files.length || !steps.length) return setEstimate(null);
    const t = setTimeout(() => {
      api
        .estimate(recipe, files.map((f) => f.id))
        .then((r) => {
          setEstimate(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Estimate failed"));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeKey, files]);

  const kinds = new Set(files.map((f) => f.kind));
  const move = (i: number, d: -1 | 1) =>
    setSteps((xs) => {
      const ys = [...xs];
      const j = i + d;
      if (j < 0 || j >= ys.length) return xs;
      [ys[i], ys[j]] = [ys[j], ys[i]];
      return ys;
    });

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const b = await api.createBatch(files.map((f) => f.id), recipe, name || undefined);
      toast(`Batch started: ${b.total_files} files`, "success");
      nav(`/batches/${b.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start batch");
    } finally {
      setSubmitting(false);
    }
  };

  const available = Object.keys(OPS).filter((op) => !steps.some((s) => s.op === op));
  const planMax = me?.plan.max_output_res ?? "fhd";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Recipe builder</h1>
          <div className="muted">
            Same edit chain for {files.length} file{files.length === 1 ? "" : "s"} (
            {[...kinds].map((k) => `${files.filter((f) => f.kind === k).length} ${k}`).join(", ")})
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div className="stack">
          {saved.length > 0 && (
            <div className="row wrap">
              <span className="small muted">Start from:</span>
              {saved.map((r) => (
                <button key={r.id} className="chip" onClick={() => setSteps(r.body.steps.map((s) => ({ ...newStep(s.op), ...s, params: { ...OPS[s.op].defaults, ...s.params } })))}>
                  {r.name}
                </button>
              ))}
            </div>
          )}
          {steps.map((s, i) => (
            <div key={`${s.op}-${i}`} className="card stack">
              <div className="row">
                <span className="mono muted">{i + 1}</span>
                <button className="btn ghost sm" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                  <b>{summarize(s)}</b>
                </button>
                {OPS[s.op].media.length < 3 && <span className="small muted">videos only</span>}
                <span className="spacer" />
                <button className="btn ghost icon-btn sm" onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp size={15} />
                </button>
                <button className="btn ghost icon-btn sm" onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown size={15} />
                </button>
                <button className="btn ghost icon-btn sm" onClick={() => setSteps((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
              {open === i && <StepEditor step={s} onChange={(n) => setSteps((xs) => xs.map((x, j) => (j === i ? n : x)))} />}
            </div>
          ))}
          <div className="row wrap">
            {available.map((op) => (
              <button
                key={op}
                className="chip"
                onClick={() => {
                  setSteps((xs) => [...xs, newStep(op)]);
                  setOpen(steps.length);
                }}
              >
                <Plus size={14} /> {OPS[op].label}
              </button>
            ))}
          </div>
        </div>

        <div className="card stack" style={{ position: "sticky", top: 16 }}>
          <label className="field">
            <span>Batch name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Batch of ${files.length}`} />
          </label>
          {kinds.has("image") && (
            <Segmented
              label="Photo format"
              value={output.image_format}
              options={[
                { value: "jpg", label: "JPG" },
                { value: "png", label: "PNG" },
                { value: "webp", label: "WEBP" },
              ]}
              onChange={(image_format) => setOutput({ ...output, image_format })}
            />
          )}
          {(kinds.has("video") || kinds.has("gif")) && (
            <Segmented
              label="Video format"
              value={output.video_format}
              options={[
                { value: "mp4", label: "MP4" },
                { value: "mov", label: "MOV" },
                { value: "gif", label: "GIF" },
              ]}
              onChange={(video_format) => setOutput({ ...output, video_format })}
            />
          )}
          <Segmented
            label="Resolution"
            value={output.resolution}
            options={RESOLUTIONS.map((r) => ({ value: r.value, label: r.label, disabled: !resolutionAllowed(r.value, planMax) }))}
            onChange={(resolution) => setOutput({ ...output, resolution })}
          />
          <div className="thumbs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
            {files.slice(0, 24).map((f) => (
              <div key={f.id} className="thumb" title={f.original_name}>
                {f.thumb_url && <img src={f.thumb_url} alt="" />}
                <span className="badge" style={{ transform: "scale(.8)", transformOrigin: "top left" }}>
                  <KindBadge kind={f.kind} />
                </span>
              </div>
            ))}
          </div>
          <div className="row">
            <span className="muted">
              Estimated: <b className="mono" data-testid="batch-estimate">{estimate?.total_credits ?? "…"}</b> credits
            </span>
            <span className="spacer" />
            <span className="small muted mono">balance {me?.credits}</span>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button
            className="btn primary"
            onClick={submit}
            disabled={submitting || !files.length || !steps.length || estimate?.affordable === false}
            data-testid="start-batch"
          >
            {submitting ? "Starting…" : `Process ${files.length} file${files.length === 1 ? "" : "s"}`}
          </button>
          <p className="small muted" style={{ margin: 0 }}>
            Processing runs in the cloud. You can close this tab and we'll keep going.
          </p>
        </div>
      </div>
    </>
  );
}
