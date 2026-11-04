'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AdminJob {
  id: string;
  user_email: string;
  status: string;
  caption_style: string;
  clips_count: number;
  credits_used: number;
  created_at: string;
  error_message?: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-gray-500/10 text-gray-400',
};

function useAdminJobs(page: number, status: string) {
  return useQuery({
    queryKey: ['admin-jobs', page, status],
    queryFn: () =>
      api
        .get('/admin/jobs', { params: { page, limit: 20, status: status || undefined } })
        .then(r => r.data),
    placeholderData: keepPreviousData,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminJobsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading, isError } = useAdminJobs(page, status);
  const jobs: AdminJob[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
        <p className="text-gray-400 mt-1">{total.toLocaleString()} total jobs</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'processing', 'completed', 'failed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              status === s
                ? 'bg-[#f5c518] text-black'
                : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:text-white'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load jobs</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No jobs found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['User', 'Status', 'Style', 'Clips', 'Credits', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {jobs.map(j => (
                <tr key={j.id} className="hover:bg-[#1a1a1a] transition group">
                  <td className="px-4 py-3 text-gray-300 text-xs">{j.user_email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        STATUS_COLOR[j.status] ?? 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {j.status}
                    </span>
                    {j.error_message && (
                      <p
                        className="text-[10px] text-red-400 mt-0.5 max-w-[160px] truncate"
                        title={j.error_message}
                      >
                        {j.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{j.caption_style}</td>
                  <td className="px-4 py-3 text-gray-300">{j.clips_count}</td>
                  <td className="px-4 py-3 text-[#f5c518] font-mono">{j.credits_used}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(j.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-[#2a2a2a] flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
