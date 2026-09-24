import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useApp } from "../lib/app-state";

export function ProgressBar({ value, status }: { value: number; status?: string }) {
  const cls =
    status === "running" || status === "queued" || status === "cancelling"
      ? "running"
      : status === "failed" || status === "cancelled"
        ? "failed"
        : status === "succeeded" || status === "completed"
          ? "done"
          : "";
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`progress ${cls}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${status === "succeeded" || status === "completed" ? 100 : pct}%` }} />
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn ghost icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CreditRing() {
  const { me } = useApp();
  if (!me) return null;
  const frac = Math.max(0, Math.min(1, me.credits / Math.max(1, me.plan.monthly_credits)));
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <div className="credit-ring" title={`${me.credits} of ${me.plan.monthly_credits} monthly credits`}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--elevated)" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          style={{ filter: "drop-shadow(0 0 4px rgba(0,240,255,.6))" }}
        />
      </svg>
      <div>
        <div className="mono" data-testid="credits">{me.credits}</div>
        <div className="small muted">{me.plan.name} credits</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return <span className="badge">{kind === "image" ? "IMG" : kind === "video" ? "VID" : "GIF"}</span>;
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step = 1, unit = "", onChange } = props;
  return (
    <label className="field">
      <span>
        {label}
        <b className="mono">
          {step < 1 ? value.toFixed(2) : value}
          {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Segmented<T extends string | number>(props: {
  label?: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      {props.label && <span>{props.label}</span>}
      <div className="seg" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === props.value}
            className={o.value === props.value ? "on" : ""}
            disabled={o.disabled}
            title={o.title}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
