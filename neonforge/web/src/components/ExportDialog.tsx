import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Job, MediaFile, OutputSpec, Step } from "../api/types";
import { useApp, useJobWatcher } from "../lib/app-state";
import { buildRecipe, formatBytes, RESOLUTIONS, resolutionAllowed } from "../lib/recipe";
import { Modal, ProgressBar, Segmented, StatusPill } from "./ui";

export function ExportDialog({ file, steps, onClose }: { file: MediaFile; steps: Step[]; onClose: () => void }) {
  const { me, toast } = useApp();
  const watch = useJobWatcher();
  const isImage = file.kind === "image";
  const [spec, setSpec] = useState<OutputSpec>({
    image_format: file.analysis?.has_alpha || steps.some((s) => s.op === "background" && s.params.mode === "remove") ? "png" : "jpg",
    video_format: file.kind === "gif" ? "gif" : "mp4",
    resolution: "original",
    quality: "balanced",
    strip_metadata: true,
    gif_fps: 15,
  });
  const [cost, setCost] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [live, setLive] = useState<{ status: string; progress: number; stage: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipe = buildRecipe(steps, spec);
  useEffect(() => {
    api
      .estimate(recipe, [file.id])
      .then((r) => setCost(r.total_credits))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not estimate"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(recipe.steps)]);

  const start = async () => {
    setError(null);
    try {
      const j = await api.render(file.id, recipe);
      setJob(j);
      await watch(j.id, setLive);
      const final = await api.job(j.id);
      setJob(final);
      if (final.status === "succeeded") toast("Export ready", "success");
      else if (final.error) setError(final.error.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Export failed");
    }
  };

  const out = job?.outputs?.[0];
  const planMax = me?.plan.max_output_res ?? "fhd";
  return (
    <Modal title="Export" onClose={onClose}>
      {!job && (
        <>
          {isImage ? (
            <Segmented
              label="Format"
              value={spec.image_format}
              options={[
                { value: "jpg", label: "JPG" },
                { value: "png", label: "PNG" },
                { value: "webp", label: "WEBP" },
              ]}
              onChange={(image_format) => setSpec({ ...spec, image_format })}
            />
          ) : (
            <Segmented
              label="Format"
              value={spec.video_format}
              options={[
                { value: "mp4", label: "MP4" },
                { value: "mov", label: "MOV" },
                { value: "gif", label: "GIF" },
              ]}
              onChange={(video_format) => setSpec({ ...spec, video_format })}
            />
          )}
          <Segmented
            label="Resolution"
            value={spec.resolution}
            options={RESOLUTIONS.filter((r) => isImage || r.value !== "8k").map((r) => ({
              value: r.value,
              label: r.label,
              disabled: !resolutionAllowed(r.value, planMax),
              title: resolutionAllowed(r.value, planMax) ? undefined : "Upgrade your plan for this resolution",
            }))}
            onChange={(resolution) => setSpec({ ...spec, resolution })}
          />
          <p className="small muted" style={{ margin: 0 }}>
            Exports never upscale on their own. Add an Upscale step to go beyond the source size. Your plan exports up to{" "}
            {planMax.toUpperCase()}.
          </p>
          <Segmented
            label="Quality"
            value={spec.quality}
            options={[
              { value: "small", label: "Small" },
              { value: "balanced", label: "Balanced" },
              { value: "max", label: "Max" },
            ]}
            onChange={(quality) => setSpec({ ...spec, quality })}
          />
          {!isImage && spec.video_format === "gif" && (
            <Segmented
              label="GIF frame rate"
              value={spec.gif_fps}
              options={[10, 15, 24].map((v) => ({ value: v, label: `${v} fps` }))}
              onChange={(gif_fps) => setSpec({ ...spec, gif_fps })}
            />
          )}
          {me?.plan.watermark && <p className="small muted">Free plan exports carry a small “AI-edited” badge.</p>}
          <div className="row">
            <span className="muted">
              Cost: <b className="mono">{cost ?? "…"}</b> credits · balance <span className="mono">{me?.credits}</span>
            </span>
            <span className="spacer" />
            <button className="btn primary" onClick={start} disabled={cost === null || (me?.credits ?? 0) < (cost ?? 0)} data-testid="start-export">
              Export
            </button>
          </div>
        </>
      )}
      {job && (
        <div className="stack">
          <div className="row">
            <StatusPill status={live?.status ?? job.status} />
            <span className="muted small">{live?.stage ?? job.stage}</span>
            <span className="spacer" />
            <span className="mono small">{Math.round((live?.progress ?? job.progress) * 100)}%</span>
          </div>
          <ProgressBar value={live?.progress ?? job.progress} status={live?.status ?? job.status} />
          {out && (
            <div className="card stack">
              <div className="row">
                <b>{out.filename}</b>
                <span className="spacer" />
                <span className="small muted mono">
                  {out.width}×{out.height} · {formatBytes(out.size_bytes)}
                </span>
              </div>
              <a className="btn primary" href={out.download_url} data-testid="download">
                <Download size={16} /> Save to device
              </a>
              <p className="small muted" style={{ margin: 0 }}>
                The file carries AI-edit provenance metadata. Cloud export (Drive, Dropbox, OneDrive) comes in a later milestone.
              </p>
            </div>
          )}
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
