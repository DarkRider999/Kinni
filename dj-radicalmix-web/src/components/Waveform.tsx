import { useEffect, useRef } from "react";
import type { WaveformPeaks } from "../lib/waveform";

interface Props {
  peaks: WaveformPeaks | null;
  position: number;
  duration: number;
  color: string;
  height?: number;
  // slot -> position in seconds. Approximate (see useDecks.setHotCueAt): the
  // engine may snap the actual cue to the beat grid when quantize is on.
  hotCues?: Record<number, number>;
}

export function Waveform({ peaks, position, duration, color, height = 56, hotCues }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!peaks || peaks.min.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    const bins = peaks.min.length;
    const mid = height / 2;
    ctx.fillStyle = color;
    for (let x = 0; x < width; x++) {
      const bin = Math.floor((x / width) * bins);
      const lo = peaks.min[bin] ?? 0;
      const hi = peaks.max[bin] ?? 0;
      const y1 = mid - hi * mid;
      const y2 = mid - lo * mid;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }

    if (duration > 0 && hotCues) {
      ctx.fillStyle = "#ffb020";
      ctx.font = "9px sans-serif";
      ctx.textBaseline = "top";
      for (const [slot, cuePos] of Object.entries(hotCues)) {
        const x = Math.min(width - 2, Math.max(0, (cuePos / duration) * width));
        ctx.fillRect(x, 0, 2, height);
        ctx.fillText(String(Number(slot) + 1), x + 2, 1);
      }
    }

    if (duration > 0) {
      const playX = Math.min(width, Math.max(0, (position / duration) * width));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(playX, 0, 1.5, height);
    }
  }, [peaks, position, duration, color, height, hotCues]);

  return <canvas ref={canvasRef} style={{ width: "100%", height, display: "block", borderRadius: 6 }} />;
}
