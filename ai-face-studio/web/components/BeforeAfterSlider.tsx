import { useCallback, useRef, useState } from 'react';

export function BeforeAfterSlider({ originalSrc, resultSrc }: { originalSrc: string; resultSrc: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full touch-none select-none overflow-hidden rounded-xl2 border border-line"
      onMouseDown={(e) => { dragging.current = true; updateFromClientX(e.clientX); }}
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resultSrc} alt="AI result" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={originalSrc} alt="Original" className="h-full w-full object-cover" style={{ width: `${(100 / pos) * 100 || 0}%` }} draggable={false} />
      </div>
      <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold tracking-wide text-white/80">ORIGINAL</div>
      <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold tracking-wide text-accent-cyanSoft">AI RESULT</div>
      <div className="absolute inset-y-0 w-[2px] bg-white/80" style={{ left: `${pos}%` }} />
      <div
        className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg"
        style={{ left: `${pos}%` }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0F" strokeWidth={2.4} strokeLinecap="round">
          <path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" />
        </svg>
      </div>
    </div>
  );
}
