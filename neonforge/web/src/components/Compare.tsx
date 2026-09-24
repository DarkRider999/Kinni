import { useRef, useState, type PointerEvent } from "react";
import type { FaceInfo } from "../api/types";

/** Before/after split slider for images (drag, click or arrow keys). */
export function CompareImage(props: { before: string; after?: string | null; faces?: FaceInfo[]; srcWidth?: number | null }) {
  const [pos, setPos] = useState(0.5);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const move = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  const after = props.after;
  const scale = natural && props.srcWidth ? natural.w / props.srcWidth : 1;

  return (
    <div
      ref={ref}
      className="compare"
      onPointerDown={(e) => {
        if (!after) return;
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => dragging.current && move(e)}
      onPointerUp={() => (dragging.current = false)}
      data-testid="compare"
    >
      <img
        src={props.before}
        alt="Original"
        draggable={false}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {props.faces && natural && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {props.faces.map((f) => {
            const [x, y, w, h] = f.box;
            return (
              <div
                key={f.index}
                className="face-box"
                style={{
                  left: `${((x * scale) / natural.w) * 100}%`,
                  top: `${((y * scale) / natural.h) * 100}%`,
                  width: `${((w * scale) / natural.w) * 100}%`,
                  height: `${((h * scale) / natural.h) * 100}%`,
                }}
              />
            );
          })}
        </div>
      )}
      {after && (
        <>
          <div className="after" style={{ clipPath: `inset(0 0 0 ${pos * 100}%)` }}>
            <img src={after} alt="Edited preview" draggable={false} data-testid="preview-image" />
          </div>
          <div
            className="handle"
            style={{ left: `${pos * 100}%` }}
            role="slider"
            tabIndex={0}
            aria-label="Before/after position"
            aria-valuenow={Math.round(pos * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 0.05));
              if (e.key === "ArrowRight") setPos((p) => Math.min(1, p + 0.05));
            }}
          />
          <span className="badge tag" style={{ left: 10 }}>
            Before
          </span>
          <span className="badge tag" style={{ right: 10 }}>
            After
          </span>
        </>
      )}
    </div>
  );
}
