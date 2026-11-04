'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { IClip } from '@ananvi/shared';

function useClips(page = 1, favoritesOnly = false) {
  return useQuery({
    queryKey: ['clips', page, favoritesOnly],
    queryFn: () =>
      api.get('/clips', { params: { page, limit: 12, favorites: favoritesOnly || undefined } }).then(r => r.data),
  });
}

function useToggleFavorite(onError: (msg: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
      api.patch(`/clips/${id}/favorite`, { is_favorite }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clips'] });
    },
    onError: (err: any) => {
      onError(err?.response?.data?.message ?? 'Failed to update favorite');
    },
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function ClipsPage() {
  const [page, setPage] = useState(1);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');
  const { data, isLoading, error } = useClips(page, favoritesOnly);
  const toggleFavorite = useToggleFavorite((msg) => {
    setFavoriteError(msg);
    setTimeout(() => setFavoriteError(''), 4000);
  });

  const clips: IClip[] = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / 12);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Clips</h1>
          <p className="text-gray-400 mt-1">All generated clips from your jobs</p>
        </div>
        <button
          onClick={() => { setFavoritesOnly(f => !f); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
            favoritesOnly
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-[#111] border-[#2a2a2a] text-gray-400 hover:text-white'
          }`}
        >
          <svg
            className={`w-4 h-4 ${favoritesOnly ? 'fill-red-400 text-red-400' : 'fill-transparent text-gray-400'}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Favorites
        </button>
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

      {favoriteError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {favoriteError}
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
                {formatDuration(clip.duration)}
              </div>
              <button
                onClick={() => toggleFavorite.mutate({ id: clip.id, is_favorite: !clip.is_favorite })}
                disabled={toggleFavorite.isPending}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60
                           hover:bg-black/80 transition disabled:opacity-50"
                title={clip.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <svg
                  className={`w-4 h-4 transition ${clip.is_favorite ? 'text-red-400 fill-red-400' : 'text-gray-400 fill-transparent'}`}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <div className="p-4">
              <p className="text-white font-medium truncate text-sm">{clip.title}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{formatDate(clip.created_at)}</span>
                <div className="flex items-center gap-2">
                  {clip.export_count > 0 && (
                    <span className="text-xs text-gray-600">{clip.export_count}↓</span>
                  )}
                  <span className="text-xs text-gray-500 font-mono">
                    {clip.overall_score.toFixed(1)} / 10
                  </span>
                </div>
              </div>
              <a
                href={clip.video_url}
                download
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
