'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Clip {
  id: string;
  job_id: string;
  title: string;
  duration_ms: number;
  output_url: string;
  thumbnail_url?: string;
  created_at: string;
  caption_style: string;
}

function useClips(page = 1) {
  return useQuery({
    queryKey: ['clips', page],
    queryFn: () =>
      api.get('/clips', { params: { page, limit: 12 } }).then(r => r.data),
  });
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function ClipsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useClips(page);

  const clips: Clip[] = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Clips</h1>
        <p className="text-gray-400 mt-1">All generated clips from your jobs</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          Failed to load clips
        </div>
      )}

      {!isLoading && clips.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">🎞️</div>
          <p className="text-lg">No clips yet</p>
          <p className="text-sm mt-2">Generate your first clips from the Studio</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map(clip => (
          <div
            key={clip.id}
            className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden
                       hover:border-[#f5c518]/30 transition group"
          >
            {/* Thumbnail */}
            <div className="aspect-video bg-[#0a0a0a] relative">
              {clip.thumbnail_url ? (
                <img
                  src={clip.thumbnail_url}
                  alt={clip.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700">
                  <span className="text-3xl">🎬</span>
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs
                              px-2 py-0.5 rounded font-mono">
                {formatDuration(clip.duration_ms)}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <p className="text-white font-medium truncate text-sm">{clip.title}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{formatDate(clip.created_at)}</span>
                <span className="text-xs bg-[#f5c518]/10 text-[#f5c518] px-2 py-0.5 rounded">
                  {clip.caption_style}
                </span>
              </div>
              <a
                href={clip.output_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm
                           bg-[#1a1a1a] hover:bg-[#f5c518] hover:text-black text-gray-300
                           rounded-lg transition font-medium"
              >
                ↓ Download
              </a>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm bg-[#111] border border-[#2a2a2a] text-gray-400
                       rounded-lg hover:text-white disabled:opacity-40 transition"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-gray-400">
            {page} / {totalPages}
          </span>
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
  );
}
