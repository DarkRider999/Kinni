import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { UserSettings } from "../api/types";
import { CreditRing, Segmented, Toggle } from "../components/ui";
import { useApp } from "../lib/app-state";
import { applyTheme } from "../lib/theme";

const LANGUAGES = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["es", "Español"],
  ["pt-BR", "Português (BR)"],
  ["id", "Bahasa Indonesia"],
  ["ar", "العربية"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ja", "日本語"],
  ["ko", "한국어"],
] as const;

export function Settings() {
  const { me, toast } = useApp();
  const [s, setS] = useState<UserSettings | null>(null);

  useEffect(() => {
    api.getSettings().then(setS);
  }, []);

  const save = async (patch: Partial<UserSettings>) => {
    if (!s) return;
    setS({ ...s, ...patch });
    try {
      const next = await api.putSettings(patch);
      setS(next);
      if (patch.theme) applyTheme(patch.theme);
    } catch {
      toast("Could not save settings", "error");
    }
  };

  if (!s || !me) return <div className="muted">Loading…</div>;
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <div className="muted">{me.email}</div>
        </div>
        <span className="spacer" />
        <CreditRing />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <section className="card stack">
          <h3>Quality</h3>
          <Segmented
            label="Processing lane"
            value={s.quality_lane}
            options={[
              { value: "fast", label: "Fast" },
              { value: "balanced", label: "Balanced" },
              { value: "max", label: "Max quality" },
            ]}
            onChange={(quality_lane) => save({ quality_lane })}
          />
          <p className="small muted" style={{ margin: 0 }}>
            Fast uses lighter models when the queue is busy. Max always uses the best model, even if you have to wait longer.
          </p>
        </section>
        <section className="card stack">
          <h3>Output defaults</h3>
          <Segmented
            label="Photo format"
            value={s.default_image_format}
            options={[
              { value: "jpg", label: "JPG" },
              { value: "png", label: "PNG" },
              { value: "webp", label: "WEBP" },
            ]}
            onChange={(default_image_format) => save({ default_image_format })}
          />
          <Segmented
            label="Video format"
            value={s.default_video_format}
            options={[
              { value: "mp4", label: "MP4" },
              { value: "mov", label: "MOV" },
              { value: "gif", label: "GIF" },
            ]}
            onChange={(default_video_format) => save({ default_video_format })}
          />
          <Toggle label="Strip location & camera metadata" checked={s.strip_metadata} onChange={(strip_metadata) => save({ strip_metadata })} />
        </section>
        <section className="card stack">
          <h3>Language & appearance</h3>
          <label className="field">
            <span>Language</span>
            <select value={s.language} onChange={(e) => save({ language: e.target.value })} aria-label="Language">
              {LANGUAGES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label="Theme"
            value={s.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
            onChange={(theme) => save({ theme })}
          />
        </section>
        <section className="card stack">
          <h3>Storage & notifications</h3>
          <Segmented
            label="Auto-delete originals after"
            value={s.auto_delete_days}
            options={[1, 7, 30, 90].map((d) => ({ value: d, label: `${d} d` }))}
            onChange={(auto_delete_days) => save({ auto_delete_days })}
          />
          <Toggle label="Notify when jobs finish" checked={s.notify_job_complete} onChange={(notify_job_complete) => save({ notify_job_complete })} />
        </section>
        <section className="card stack">
          <h3>Plan</h3>
          <div className="row">
            <b>{me.plan.name}</b>
            <span className="spacer" />
            <span className="mono">{me.credits} credits</span>
          </div>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{me.plan.monthly_credits} credits / month</li>
            <li>Up to {me.plan.max_batch_files} files per batch</li>
            <li>Videos up to {Math.round(me.plan.max_video_seconds / 60)} min, {me.plan.max_upload_mb} MB uploads</li>
            <li>
              Export up to {me.plan.max_output_res.toUpperCase()}, upscale up to {me.plan.max_upscale}x
            </li>
            <li>{me.plan.watermark ? "“AI-edited” badge on exports" : "No watermark"}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
