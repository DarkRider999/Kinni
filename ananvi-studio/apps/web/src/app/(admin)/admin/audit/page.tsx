'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AuditEntry {
  id: string;
  user_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

const ACTION_COLOR: Record<string, string> = {
  login: 'bg-blue-500/10 text-blue-400',
  logout: 'bg-gray-500/10 text-gray-400',
  register: 'bg-green-500/10 text-green-400',
  password_change: 'bg-yellow-500/10 text-yellow-400',
  totp_enable: 'bg-purple-500/10 text-purple-400',
  totp_disable: 'bg-orange-500/10 text-orange-400',
  credit_purchase: 'bg-green-500/10 text-green-400',
  job_create: 'bg-blue-500/10 text-blue-400',
  job_cancel: 'bg-red-500/10 text-red-400',
  admin_credit_adjust: 'bg-yellow-500/10 text-yellow-400',
};

function useAuditLog(page: number, action: string) {
  return useQuery({
    queryKey: ['audit-log', page, action],
    queryFn: () =>
      api
        .get('/admin/audit', { params: { page, limit: 25, action: action || undefined } })
        .then(r => r.data),
    placeholderData: keepPreviousData,
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const { data, isLoading } = useAuditLog(page, action);
  const entries: AuditEntry[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  const ACTIONS = [
    '',
    'login',
    'register',
    'password_change',
    'totp_enable',
    'totp_disable',
    'credit_purchase',
    'job_create',
    'job_cancel',
    'admin_credit_adjust',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 mt-1">{total.toLocaleString()} entries</p>
      </div>

      {/* Action filter */}
      <div className="flex gap-2 flex-wrap">
        {ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => { setAction(a); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              action === a
                ? 'bg-[#f5c518] text-black'
                : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:text-white'
            }`}
          >
            {a || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit entries found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Time', 'User', 'Action', 'Target', 'IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-[#1a1a1a] transition">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDateTime(e.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {e.user_email ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        ACTION_COLOR[e.action] ?? 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {e.target_type ? `${e.target_type}:${e.target_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                    {e.ip_address ?? '—'}
                  </td>
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
