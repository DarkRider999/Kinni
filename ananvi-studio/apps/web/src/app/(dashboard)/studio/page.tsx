'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStudioStore } from '@/stores/studio.store';
import { useCreateJob, useJobs } from '@/hooks/useJobs';
import { useCredits } from '@/hooks/useCredits';
import { CaptionStyle, AIVideoStyle } from '@ananvi/shared';

const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: CaptionStyle.WAVY, label: 'Wavy' },
  { value: CaptionStyle.EXCITED, label: 'Excited' },
  { value: CaptionStyle.TENSION, label: 'Tension' },
  { value: CaptionStyle.NEON, label: 'Neon' },
  { value: CaptionStyle.LOWKEY, label: 'Lowkey' },
  { value: CaptionStyle.ANIMATED, label: 'Animated' },
];

export default function StudioPage() {
  const store = useStudioStore();
  const createJob = useCreateJob();
  const { data: credits } = useCredits();
  const { data: jobsData, isError: jobsError } = useJobs();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!store.url.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await createJob.mutateAsync({
        source_url: store.url,
        clip_count: store.clipCount,
        caption_style: store.captionStyle,
        caption_language: store.captionLanguage,
        ai_video_style: store.aiVideoStyle || undefined,
      });
      store.setActiveJob(result.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Studio</h1>
        <p className="text-gray-400 mt-1">
          Paste a link. Get ten clips. — Credits: {credits?.balance ?? 0}
        </p>
      </div>

      {/* URL Input */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Video URL
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={store.url}
            onChange={e => store.setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3
                       text-white placeholder:text-gray-600 focus:border-[#f5c518]
                       focus:ring-1 focus:ring-[#f5c518] outline-none transition"
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !store.url.trim()}
            className="px-8 py-3 bg-[#f5c518] text-black font-semibold rounded-lg
                       hover:bg-[#d4a800] disabled:opacity-50 disabled:cursor-not-allowed
                       transition whitespace-nowrap"
          >
            {isSubmitting ? 'Processing…' : 'Generate Clips'}
          </button>
        </div>

        {/* Options row */}
        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <label className="text-xs text-gray-500">Clips</label>
            <select
              value={store.clipCount}
              onChange={e => store.setClipCount(Number(e.target.value))}
              className="block mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2
                         text-white text-sm"
            >
              {[5, 10, 15, 20, 30].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Caption Style</label>
            <select
              value={store.captionStyle}
              onChange={e => store.setCaptionStyle(e.target.value as CaptionStyle)}
              className="block mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2
                         text-white text-sm"
            >
              {CAPTION_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Language</label>
            <select
              value={store.captionLanguage}
              onChange={e => store.setCaptionLanguage(e.target.value)}
              className="block mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2
                         text-white text-sm"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="hi">Hindi</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">
              AI Video Style <span className="text-gray-600">(optional)</span>
            </label>
            <select
              value={store.aiVideoStyle ?? ''}
              onChange={e => store.setAiVideoStyle((e.target.value as AIVideoStyle) || null)}
              className="block mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2
                         text-white text-sm"
            >
              <option value="">None — use original video</option>
              <option value={AIVideoStyle.FOUND_FOOTAGE}>Found Footage</option>
              <option value={AIVideoStyle.ANIMAL_CLIPS}>Animal Clips</option>
              <option value={AIVideoStyle.SECURITY_CAM}>Security Cam</option>
              <option value={AIVideoStyle.COURT_COMEDY}>Court Comedy</option>
              <option value={AIVideoStyle.CARTOON_3D}>3D Cartoon</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Jobs</h2>
        {jobsError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-3">
            Could not load recent jobs. Please refresh the page.
          </div>
        )}
        <div className="space-y-3">
          {jobsData?.data?.map((job: any) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition"
            >
              <div>
                <p className="text-white font-medium truncate max-w-md">{job.source_url}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {job.clip_count} clips · {job.caption_style} · {job.credits_charged} credits
                </p>
              </div>
              <div className="flex items-center gap-4">
                {job.status === 'processing' && (
                  <div className="w-32 bg-[#1a1a1a] rounded-full h-2">
                    <div
                      className="bg-[#f5c518] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress_percent}%` }}
                    />
                  </div>
                )}
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  job.status === 'complete' ? 'bg-green-500/10 text-green-400' :
                  job.status === 'processing' ? 'bg-blue-500/10 text-blue-400' :
                  job.status === 'error' ? 'bg-red-500/10 text-red-400' :
                  job.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400' :
                  'bg-gray-500/10 text-gray-400'
                }`}>
                  {job.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
