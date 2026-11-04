'use client';

import { useEffect } from 'react';
import { IClip } from '@ananvi/shared';

interface ClipViewerModalProps {
  clip: IClip | null;
  onClose: () => void;
}

function scoreColor(score: number): string {
  if (score >= 7.5) return 'text-green-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

export default function ClipViewerModal({ clip, onClose }: ClipViewerModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!clip) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl mx-auto mt-10 mb-10 bg-[#111] rounded-xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center transition"
          aria-label="Close"
        >
          ✕
        </button>

        <video
          src={clip.video_url}
          controls
          autoPlay
          className="w-full max-h-[60vh] bg-black"
        />

        <div className="p-4">
          <h3 className="text-white font-semibold text-lg mb-3">{clip.title}</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Hook: <span className={scoreColor(clip.hook_score)}>{clip.hook_score.toFixed(1)}</span>
            </span>
            <span>
              Flow: <span className={scoreColor(clip.flow_score)}>{clip.flow_score.toFixed(1)}</span>
            </span>
            <span>
              Value: <span className={scoreColor(clip.value_score)}>{clip.value_score.toFixed(1)}</span>
            </span>
            <span>
              Overall: <span className={`font-bold ${scoreColor(clip.overall_score)}`}>{clip.overall_score.toFixed(1)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
