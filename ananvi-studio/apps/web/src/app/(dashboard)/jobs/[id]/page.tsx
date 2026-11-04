'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useJob, useJobClips, useCancelJob } from '@/hooks/useJobs';
import ClipViewerModal from '@/components/ClipViewerModal';
import { IClip, JobStatus } from '@ananvi/shared';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 7.5) return 'text-green-400 bg-green-500/10';
  if (score >= 5) return 'text-yellow-400 bg-yellow-500/10';
  return 'text-red-400 bg-red-500/10';
}

function statusPill(status: string) {
  const styles: Record<string, string> = {
    complete: 'bg-green-500/10 text-green-400',
    processing: 'bg-blue-500/10 text-blue-400',
    queued: 'bg-gray-500/10 text-gray-400',
    error: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-gray-500/10 text-gray-400',
  };
  return (
    <span className={`text-sm font-medium px-3 py-1 rounded-full ${styles[status] ?? 'bg-gray-500/10 text-gray-400'}`}>
      {status}
    </span>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : undefined;

  const { data: jobData, isLoading: jobLoading } = useJob(id ?? '');
  const { data: clipsData } = useJobClips(id);
  const cancelJob = useCancelJob();

  const [activeClip, setActiveClip] = useState<IClip | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const job = jobData?.data;
  const clips: IClip[] = clipsData?.data ?? [];

  const isActive = job?.status === JobStatus.QUEUED || job?.status === JobStatus.PROCESSING;

  const handleCancel = () => {
    if (!id) return;
    if (window.confirm('Cancel this job? This cannot be undone.')) {
      cancelJob.mutate(id, {
        onSuccess: () => router.push('/studio'),
        onError: (err: any) => setCancelError(err.response?.data?.message ?? 'Failed to cancel job'),
      });
    }
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-gray-400">Job not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/studio" className="text-gray-400 hover:text-white transition text-lg">
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate max-w-xl">
              {job.source_url ? job.source_url : `Job #${job.id.slice(0, 8)}`}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Created {new Date(job.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {statusPill(job.status)}
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelJob.isPending}
              className="px-4 py-1.5 text-sm border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {job.status === JobStatus.ERROR && job.error_message && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          <p className="font-semibold mb-1">Error</p>
          <p className="text-sm">{job.error_message}</p>
        </div>
      )}

      {/* Cancel error banner */}
      {cancelError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center justify-between">
          <p className="text-sm">{cancelError}</p>
          <button onClick={() => setCancelError(null)} className="text-red-400 hover:text-white ml-4 text-xs">Dismiss</button>
        </div>
      )}

      {/* Progress section */}
      {isActive && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{job.status === JobStatus.QUEUED ? 'Queued — waiting to start' : 'Processing your video…'}</span>
            <span>{job.progress_percent}%</span>
          </div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-2">
            <div
              className="bg-[#f5c518] h-2 rounded-full transition-all duration-500"
              style={{ width: `${job.progress_percent}%` }}
            />
          </div>
          {job.status === JobStatus.PROCESSING && (
            <p className="text-xs text-gray-500">
              Estimated time remaining: {Math.max(0, Math.ceil((100 - job.progress_percent) / 10))} min
            </p>
          )}
        </div>
      )}

      {/* Clips grid */}
      {job.status === JobStatus.COMPLETE && clips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Clips ({clips.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {clips.map(clip => (
              <div key={clip.id} className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
                {/* Thumbnail */}
                <div
                  className="relative aspect-video cursor-pointer group"
                  onClick={() => setActiveClip(clip)}
                >
                  {clip.thumbnail_url ? (
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center">
                      <span className="text-gray-600 text-xs">No preview</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#f5c518] flex items-center justify-center">
                      <span className="text-black text-lg ml-1">▶</span>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(clip.duration)}
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  <p className="text-white text-sm font-medium line-clamp-2">{clip.title}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(clip.overall_score)}`}>
                      {clip.overall_score.toFixed(1)}
                    </span>
                    <a
                      href={clip.video_url}
                      download
                      className="text-xs text-[#f5c518] hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job info panel */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Job Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-gray-500">Credits charged</dt>
            <dd className="text-white font-medium mt-0.5">{job.credits_charged}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Clip count</dt>
            <dd className="text-white font-medium mt-0.5">{job.clip_count}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Caption style</dt>
            <dd className="text-white font-medium mt-0.5 capitalize">{job.caption_style}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Language</dt>
            <dd className="text-white font-medium mt-0.5 uppercase">{job.caption_language}</dd>
          </div>
          {job.ai_video_style && (
            <div>
              <dt className="text-xs text-gray-500">AI Video Style</dt>
              <dd className="text-white font-medium mt-0.5 capitalize">{job.ai_video_style.replace(/-/g, ' ')}</dd>
            </div>
          )}
          {job.started_at && (
            <div>
              <dt className="text-xs text-gray-500">Started</dt>
              <dd className="text-white font-medium mt-0.5">{new Date(job.started_at).toLocaleString()}</dd>
            </div>
          )}
          {job.completed_at && (
            <div>
              <dt className="text-xs text-gray-500">Completed</dt>
              <dd className="text-white font-medium mt-0.5">{new Date(job.completed_at).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Clip viewer modal */}
      <ClipViewerModal clip={activeClip} onClose={() => setActiveClip(null)} />
    </div>
  );
}
