'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useJobs, useCreateJob } from '@/hooks/useJobs';
import { CaptionStyle, AIVideoStyle, JobStatus, IJob } from '@ananvi/shared';

const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: CaptionStyle.EXCITED, label: 'Excited' },
  { value: CaptionStyle.WAVY, label: 'Wavy' },
  { value: CaptionStyle.TENSION, label: 'Tension' },
  { value: CaptionStyle.NEON, label: 'Neon' },
  { value: CaptionStyle.LOWKEY, label: 'Low Key' },
  { value: CaptionStyle.ANIMATED, label: 'Animated' },
];

const AI_VIDEO_STYLES: { value: AIVideoStyle; label: string }[] = [
  { value: AIVideoStyle.FOUND_FOOTAGE, label: 'Found Footage' },
  { value: AIVideoStyle.ANIMAL_CLIPS, label: 'Animal Clips' },
  { value: AIVideoStyle.SECURITY_CAM, label: 'Security Cam' },
  { value: AIVideoStyle.COURT_COMEDY, label: 'Court Comedy' },
  { value: AIVideoStyle.CARTOON_3D, label: '3D Cartoon' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

function statusPill(status: string) {
  const cfg: Record<string, { cls: string; label: string }> = {
    [JobStatus.COMPLETE]: { cls: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Complete' },
    [JobStatus.PROCESSING]: { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Processing' },
    [JobStatus.QUEUED]: { cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20', label: 'Queued' },
    [JobStatus.ERROR]: { cls: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Error' },
    [JobStatus.CANCELLED]: { cls: 'bg-gray-500/10 text-gray-500 border-gray-500/20', label: 'Cancelled' },
  };
  const { cls, label } = cfg[status] ?? { cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20', label: status };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function JobRow({ job }: { job: IJob }) {
  const isActive = job.status === JobStatus.QUEUED || job.status === JobStatus.PROCESSING;
  const shortUrl = job.source_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*$/, '');

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-[#111] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#f5c518]/30 transition group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate group-hover:text-[#f5c518] transition">
            {shortUrl}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span>{new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>·</span>
            <span>{job.clip_count} clips</span>
            <span>·</span>
            <span>{job.credits_charged} credits</span>
            <span>·</span>
            <span className="capitalize">{job.caption_style}</span>
          </div>
        </div>
        <div className="flex-shrink-0">{statusPill(job.status)}</div>
      </div>

      {isActive && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{job.status === JobStatus.QUEUED ? 'Waiting in queue…' : 'Processing…'}</span>
            <span>{job.progress_percent ?? 0}%</span>
          </div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
            <div
              className="bg-[#f5c518] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${job.progress_percent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {job.status === JobStatus.ERROR && job.error_message && (
        <p className="mt-2 text-xs text-red-400 truncate">{job.error_message}</p>
      )}
    </Link>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading: jobsLoading } = useJobs(page);
  const createJob = useCreateJob();

  const [url, setUrl] = useState('');
  const [clipCount, setClipCount] = useState(10);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(CaptionStyle.EXCITED);
  const [captionLanguage, setCaptionLanguage] = useState('en');
  const [aiVideoStyle, setAiVideoStyle] = useState<AIVideoStyle | ''>('');
  const [urlError, setUrlError] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  const jobs: IJob[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Please enter a YouTube URL.');
      urlInputRef.current?.focus();
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
    } catch {
      setUrlError('Please enter a valid URL (must start with http:// or https://).');
      urlInputRef.current?.focus();
      return;
    }

    createJob.mutate(
      {
        source_url: trimmed,
        clip_count: clipCount,
        caption_style: captionStyle,
        caption_language: captionLanguage,
        ai_video_style: aiVideoStyle || undefined,
      },
      {
        onSuccess: (res) => {
          setUrl('');
          router.push(`/jobs/${res.data.id}`);
        },
        onError: (err: any) => {
          setUrlError(err?.response?.data?.message ?? 'Failed to create job. Please try again.');
        },
      },
    );
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Studio</h1>
        <p className="text-gray-400 mt-1">Paste a YouTube URL to generate viral clips</p>
      </div>

      {/* Job creation form */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video URL <span className="text-red-400">*</span>
            </label>
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); }}
              placeholder="https://www.youtube.com/watch?v=..."
              className={`w-full bg-[#0a0a0a] border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600
                          focus:outline-none focus:ring-1 transition
                          ${urlError ? 'border-red-500/50 focus:ring-red-500/40' : 'border-[#2a2a2a] focus:ring-[#f5c518]/40 focus:border-[#f5c518]/40'}`}
              disabled={createJob.isPending}
            />
            {urlError && (
              <p className="mt-1.5 text-xs text-red-400">{urlError}</p>
            )}
          </div>

          {/* Row: clip count + caption style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of clips
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={clipCount}
                  onChange={e => setClipCount(Number(e.target.value))}
                  className="flex-1 accent-[#f5c518]"
                  disabled={createJob.isPending}
                />
                <span className="w-8 text-right text-white font-mono text-sm">{clipCount}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>1</span><span>30</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Caption style
              </label>
              <select
                value={captionStyle}
                onChange={e => setCaptionStyle(e.target.value as CaptionStyle)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:ring-1 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/40 transition"
                disabled={createJob.isPending}
              >
                {CAPTION_STYLES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: language + AI style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Caption language
              </label>
              <select
                value={captionLanguage}
                onChange={e => setCaptionLanguage(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:ring-1 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/40 transition"
                disabled={createJob.isPending}
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                AI video style <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <select
                value={aiVideoStyle}
                onChange={e => setAiVideoStyle(e.target.value as AIVideoStyle | '')}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:ring-1 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/40 transition"
                disabled={createJob.isPending}
              >
                <option value="">None</option>
                {AI_VIDEO_STYLES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={createJob.isPending || !url.trim()}
            className="w-full py-3 bg-[#f5c518] text-black font-semibold rounded-lg text-sm
                       hover:bg-[#d4a800] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {createJob.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Creating job…
              </span>
            ) : (
              '✂ Generate Clips'
            )}
          </button>
        </form>
      </div>

      {/* Jobs list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Recent Jobs
            {total > 0 && <span className="ml-2 text-sm text-gray-500 font-normal">({total})</span>}
          </h2>
        </div>

        {jobsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🎬</p>
            <p className="text-gray-400 text-sm">No jobs yet. Paste a URL above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => <JobRow key={job.id} job={job} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm bg-[#111] border border-[#2a2a2a] text-gray-400
                         rounded-lg hover:text-white disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm bg-[#111] border border-[#2a2a2a] text-gray-400
                         rounded-lg hover:text-white disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
