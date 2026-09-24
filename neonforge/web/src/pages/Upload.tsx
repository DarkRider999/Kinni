import { FolderUp, ImagePlus } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, uploadFile } from "../api/client";
import type { MediaFile } from "../api/types";
import { ProgressBar } from "../components/ui";
import { useApp } from "../lib/app-state";
import { ACCEPT, formatBytes } from "../lib/recipe";

interface Item {
  key: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  result?: MediaFile;
  preview?: string;
}

const ALLOWED = /\.(jpe?g|png|webp|gif|mp4|mov|avi)$/i;
const CONCURRENCY = 3;

export function Upload() {
  const [params] = useSearchParams();
  const mode = params.get("mode") === "batch" ? "batch" : "single";
  const tool = params.get("tool");
  const nav = useNavigate();
  const { me, toast } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const start = async (files: File[]) => {
    const list = files.filter((f) => ALLOWED.test(f.name));
    if (list.length < files.length) toast(`${files.length - list.length} unsupported file(s) skipped`, "error");
    if (!list.length) return;
    const limit = mode === "single" ? 1 : me?.plan.max_batch_files ?? 10;
    const picked = list.slice(0, limit);
    if (list.length > limit) toast(`Your plan allows ${limit} files per batch — extra files skipped`, "error");
    const fresh: Item[] = picked.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      progress: 0,
      status: "uploading",
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setItems((xs) => (mode === "single" ? fresh : [...xs, ...fresh]));

    const results: MediaFile[] = [];
    let next = 0;
    const worker = async () => {
      while (next < fresh.length) {
        const it = fresh[next++];
        try {
          const r = await uploadFile(it.file, (p) => update(it.key, { progress: p }));
          results.push(r);
          update(it.key, { status: "done", progress: 1, result: r });
        } catch (e) {
          update(it.key, { status: "error", error: e instanceof ApiError ? e.message : "Upload failed" });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, worker));
    if (mode === "single" && results[0]) nav(`/editor/${results[0].id}${tool ? `?tool=${tool}` : ""}`);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void start(Array.from(e.dataTransfer.files));
  };

  const done = items.filter((i) => i.status === "done" && i.result);
  const uploading = items.some((i) => i.status === "uploading");

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{mode === "single" ? "Single Edit" : "Batch Edit"}</h1>
          <div className="muted">
            JPG · PNG · WEBP · GIF · MP4 · MOV · AVI — up to {me?.plan.max_upload_mb} MB, videos up to{" "}
            {Math.round((me?.plan.max_video_seconds ?? 60) / 60)} min
          </div>
        </div>
      </div>

      <div
        className={`dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-testid="dropzone"
      >
        <ImagePlus size={40} color="var(--cyan)" />
        <h2>Drop {mode === "single" ? "a photo or video" : "photos & videos"} here</h2>
        <div className="row wrap" style={{ justifyContent: "center" }}>
          <button className="btn primary" onClick={() => input.current?.click()}>
            Choose {mode === "single" ? "file" : "files"}
          </button>
          {mode === "batch" && (
            <button className="btn" onClick={() => folder.current?.click()}>
              <FolderUp size={16} /> Choose folder
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple={mode === "batch"}
          accept={ACCEPT}
          data-testid="file-input"
          onChange={(e) => {
            void start(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={folder}
          type="file"
          hidden
          multiple
          // @ts-expect-error non-standard but supported by Chromium, Safari and Firefox
          webkitdirectory=""
          onChange={(e) => {
            void start(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h3>
              {done.length}/{items.length} uploaded
            </h3>
            <span className="spacer" />
            {mode === "batch" && (
              <button
                className="btn primary"
                disabled={uploading || done.length === 0}
                onClick={() => nav(`/batches/new?files=${done.map((d) => d.result!.id).join(",")}`)}
              >
                Build recipe for {done.length} file{done.length === 1 ? "" : "s"} →
              </button>
            )}
          </div>
          <div className="upload-list card">
            {items.map((it) => (
              <div key={it.key} className="upload-row">
                {it.result?.thumb_url || it.preview ? <img src={it.result?.thumb_url ?? it.preview} alt="" /> : <div className="ph" />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.file.name}</div>
                  {it.error ? <div className="error-text">{it.error}</div> : <ProgressBar value={it.progress} status={it.status === "done" ? "succeeded" : "running"} />}
                </div>
                <span className="small muted mono" style={{ textAlign: "right" }}>
                  {formatBytes(it.file.size)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
