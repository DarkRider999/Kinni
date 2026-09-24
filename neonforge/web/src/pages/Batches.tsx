import { Download, Pause, Play, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Batch, Job, MediaFile } from "../api/types";
import { ProgressBar, StatusPill } from "../components/ui";
import { useApp } from "../lib/app-state";
import { formatBytes, summarize } from "../lib/recipe";

export function Batches() {
  const nav = useNavigate();
  const { batches: live } = useApp();
  const [items, setItems] = useState<Batch[] | null>(null);
  useEffect(() => {
    api.batches().then((r) => setItems(r.items));
  }, []);
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Batch manager</h1>
          <div className="muted">Every batch runs in the cloud queue. Progress updates live.</div>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => nav("/upload?mode=batch")}>
          New batch
        </button>
      </div>
      {items === null ? (
        <div className="muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card empty">No batches yet.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Recipe</th>
                <th style={{ width: 220 }}>Progress</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b0) => {
                const b = { ...b0, ...(live[b0.id] ?? {}) };
                return (
                  <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => nav(`/batches/${b.id}`)}>
                    <td>
                      <Link to={`/batches/${b.id}`}>{b.name}</Link>
                    </td>
                    <td className="small muted">{b0.recipe.steps.map(summarize).join(" → ")}</td>
                    <td>
                      <ProgressBar value={b.progress} status={b.status === "running" ? "running" : b.status} />
                      <span className="small muted mono">
                        {b.done_files}/{b.total_files}
                        {b.failed_files ? ` · ${b.failed_files} failed` : ""}
                      </span>
                    </td>
                    <td>
                      <StatusPill status={b.status} />
                    </td>
                    <td className="small muted">{new Date(b.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Filter = "all" | "active" | "done" | "failed";

export function BatchDetail() {
  const { batchId = "" } = useParams();
  const { batches: liveBatches, jobs: liveJobs, toast } = useApp();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<Record<string, MediaFile>>({});
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const [b, j] = await Promise.all([api.batch(batchId), api.batchJobs(batchId)]);
    setBatch(b);
    setJobs(j.items);
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const missing = jobs.map((j) => j.file_id).filter((id) => !files[id]);
    if (!missing.length) return;
    Promise.all([...new Set(missing)].map((id) => api.file(id).catch(() => null))).then((fs) =>
      setFiles((m) => ({ ...m, ...Object.fromEntries(fs.filter(Boolean).map((f) => [f!.id, f!])) })),
    );
  }, [jobs, files]);

  // Refresh outputs when a job in this batch finishes (live events carry status, not output URLs).
  const finishedCount = Object.values(liveJobs).filter((e) => e.batch_id === batchId && e.status === "succeeded").length;
  useEffect(() => {
    if (finishedCount) void load();
  }, [finishedCount, load]);

  const merged = useMemo(
    () =>
      jobs.map((j) => {
        const ev = liveJobs[j.id];
        return ev ? { ...j, status: ev.status, progress: ev.progress, stage: ev.stage, error: ev.error ?? j.error } : j;
      }),
    [jobs, liveJobs],
  );

  if (!batch) return <div className="muted">Loading…</div>;
  const b = { ...batch, ...(liveBatches[batch.id] ?? {}) };
  const counts = {
    active: merged.filter((j) => ["pending", "queued", "running", "cancelling"].includes(j.status)).length,
    done: merged.filter((j) => j.status === "succeeded").length,
    failed: merged.filter((j) => ["failed", "cancelled"].includes(j.status)).length,
  };
  const shown = merged.filter((j) =>
    filter === "all"
      ? true
      : filter === "active"
        ? ["pending", "queued", "running", "cancelling"].includes(j.status)
        : filter === "done"
          ? j.status === "succeeded"
          : ["failed", "cancelled"].includes(j.status),
  );

  const act = async (action: "pause" | "resume" | "cancel" | "retry-failed") => {
    try {
      setBatch(await api.batchAction(batch.id, action));
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action failed", "error");
    }
  };
  const downloadAll = async () => {
    try {
      const r = await api.batchDownload(batch.id);
      window.location.href = r.url;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Download failed", "error");
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="small muted">
            <Link to="/batches">Batches</Link> /
          </div>
          <h1>{b.name}</h1>
          <div className="muted small">{batch.recipe.steps.map(summarize).join(" → ")}</div>
        </div>
        <span className="spacer" />
        <StatusPill status={b.status} />
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="small muted">Progress</div>
          <div className="v" data-testid="batch-progress">
            {b.done_files}/{b.total_files}
          </div>
          <ProgressBar value={b.progress} status={b.status === "running" ? "running" : b.status} />
        </div>
        <div className="card kpi">
          <div className="small muted">In flight</div>
          <div className="v">{counts.active}</div>
        </div>
        <div className="card kpi">
          <div className="small muted">Failed</div>
          <div className="v" style={{ color: counts.failed ? "var(--red)" : undefined }}>
            {b.failed_files}
          </div>
        </div>
        <div className="card kpi">
          <div className="small muted">Credits</div>
          <div className="v">
            {b.credits_spent}
            <span className="small muted"> / {b.credits_reserved}</span>
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ margin: "16px 0" }}>
        {b.status === "paused" ? (
          <button className="btn" onClick={() => act("resume")}>
            <Play size={15} /> Resume
          </button>
        ) : (
          <button className="btn" onClick={() => act("pause")} disabled={!["queued", "running"].includes(b.status)}>
            <Pause size={15} /> Pause
          </button>
        )}
        <button className="btn danger" onClick={() => act("cancel")} disabled={!["queued", "running", "paused"].includes(b.status)}>
          <XCircle size={15} /> Cancel remaining
        </button>
        <button className="btn" onClick={() => act("retry-failed")} disabled={!b.failed_files}>
          <RotateCcw size={15} /> Retry failed
        </button>
        <span className="spacer" />
        <div className="seg" role="tablist">
          {(["all", "active", "done", "failed"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f}
              {f !== "all" ? ` ${counts[f]}` : ""}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={downloadAll} disabled={!b.done_files} data-testid="download-zip">
          <Download size={15} /> Download ZIP
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }} />
              <th>File</th>
              <th style={{ width: 260 }}>Stage</th>
              <th>Status</th>
              <th style={{ width: 140 }} />
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => {
              const f = files[j.file_id];
              const out = j.outputs?.[0];
              return (
                <tr key={j.id} data-testid="batch-row">
                  <td>{f?.thumb_url ? <img src={f.thumb_url} alt="" /> : <div style={{ width: 44, height: 44 }} />}</td>
                  <td>
                    <div>{f?.original_name ?? "…"}</div>
                    <div className="small muted mono">{f ? formatBytes(f.size_bytes) : ""}</div>
                  </td>
                  <td>
                    <div className="small muted">{j.error?.message ?? j.stage ?? (j.status === "pending" ? "Waiting for a slot" : "")}</div>
                    <ProgressBar value={j.progress} status={j.attempt > 1 && j.status === "running" ? "retry" : j.status} />
                  </td>
                  <td>
                    <StatusPill status={j.status} />
                  </td>
                  <td>
                    <div className="row">
                    {out && (
                      <a className="btn sm" href={out.download_url}>
                        <Download size={14} />
                      </a>
                    )}
                    {["failed", "cancelled"].includes(j.status) && (
                      <button className="btn sm" onClick={() => api.retryJob(j.id).then(load)}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {["pending", "queued", "running"].includes(j.status) && (
                      <button className="btn sm" onClick={() => api.cancelJob(j.id).then(load)} aria-label="Cancel file">
                        <XCircle size={14} />
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
