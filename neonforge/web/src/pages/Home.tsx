import { Crop, ImageUp, Layers, Palette, Sparkles, Users, Waves, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Batch, MediaFile, SavedRecipe } from "../api/types";
import { CreditRing, KindBadge, ProgressBar, StatusPill } from "../components/ui";
import { useApp } from "../lib/app-state";
import { formatDuration, summarize } from "../lib/recipe";

const QUICK = [
  { label: "Enhance", icon: Sparkles, tool: "enhance" },
  { label: "Upscale 4x", icon: ImageUp, tool: "upscale4" },
  { label: "Remove BG", icon: Crop, tool: "remove_bg" },
  { label: "Blur BG", icon: Waves, tool: "blur_bg" },
  { label: "Retouch", icon: Users, tool: "retouch" },
  { label: "Color grade", icon: Palette, tool: "grade" },
  { label: "Stabilize", icon: Wand2, tool: "stabilize" },
];

export function Home() {
  const { me, batches: liveBatches } = useApp();
  const nav = useNavigate();
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);

  useEffect(() => {
    api.files().then((r) => setFiles(r.items));
    api.batches().then((r) => setBatches(r.items));
    api.recipes().then((r) => setRecipes(r.items));
  }, []);

  const active = batches
    .map((b) => ({ ...b, ...(liveBatches[b.id] ?? {}) }))
    .filter((b) => ["queued", "running", "paused"].includes(b.status));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Hi {me?.display_name} 👋</h1>
          <div className="muted">What are we creating today?</div>
        </div>
        <span className="spacer" />
        <CreditRing />
      </div>

      <div className="hero-actions">
        <button className="hero" onClick={() => nav("/upload?mode=single")} data-testid="single-edit">
          <Sparkles className="hero-icon" size={28} />
          <h2>Single Edit</h2>
          <span className="muted">One photo or video with live preview</span>
        </button>
        <button className="hero magenta" onClick={() => nav("/upload?mode=batch")} data-testid="batch-edit">
          <Layers className="hero-icon" size={28} />
          <h2>Batch Edit</h2>
          <span className="muted">Apply one recipe to many files · up to {me?.plan.max_batch_files} per batch</span>
        </button>
      </div>

      <div className="row wrap" style={{ marginTop: 16 }}>
        {QUICK.map(({ label, icon: Icon, tool }) => (
          <button key={label} className="chip" onClick={() => nav(`/upload?mode=single&tool=${tool}`)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {active.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h3>Active jobs</h3>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {active.map((b) => (
              <button key={b.id} className="card stack" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => nav(`/batches/${b.id}`)}>
                <div className="row">
                  <b>{b.name}</b>
                  <span className="spacer" />
                  <StatusPill status={b.status} />
                </div>
                <ProgressBar value={b.progress} status={b.status === "running" ? "running" : b.status} />
                <span className="small muted mono">
                  {b.done_files}/{b.total_files} done
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h3>Recent files</h3>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={() => nav("/upload?mode=single")}>
            Upload
          </button>
        </div>
        {files === null ? (
          <div className="muted">Loading…</div>
        ) : files.length === 0 ? (
          <div className="card empty">
            <ImageUp size={32} />
            <p>No files yet. Start with Single Edit or Batch Edit.</p>
          </div>
        ) : (
          <div className="thumbs">
            {files.slice(0, 18).map((f) => (
              <button key={f.id} className="thumb" onClick={() => nav(`/editor/${f.id}`)} aria-label={`Edit ${f.original_name}`}>
                {f.thumb_url && <img src={f.thumb_url} alt="" loading="lazy" />}
                <span className="badge">
                  <KindBadge kind={f.kind} />
                </span>
                <span className="name">
                  {f.original_name} {f.duration_ms ? `· ${formatDuration(f.duration_ms)}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {recipes.length > 0 && (
        <section className="section">
          <h3>Saved recipes</h3>
          <div className="row wrap">
            {recipes.map((r) => (
              <div key={r.id} className="card small" style={{ padding: "10px 14px" }}>
                <b>{r.name}</b>
                <div className="muted">{r.body.steps.map(summarize).join(" → ")}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
