'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  role: string;
  credit_balance: number;
  totp_enabled: boolean;
  created_at: string;
  is_active: boolean;
}

function useAdminUsers(page: number, search: string) {
  return useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () =>
      api
        .get('/admin/users', { params: { page, limit: 20, search: search || undefined } })
        .then(r => r.data),
    keepPreviousData: true,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const { data, isLoading } = useAdminUsers(page, debouncedSearch);
  const users: AdminUser[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const adjustCredits = async (userId: string, amount: number) => {
    try {
      await api.post(`/admin/users/${userId}/credits`, { amount });
      setActionMsg(`Credits adjusted`);
      setTimeout(() => setActionMsg(''), 3000);
    } catch {
      setActionMsg('Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 mt-1">{total.toLocaleString()} total users</p>
        </div>
        {actionMsg && <span className="text-sm text-green-400">{actionMsg}</span>}
      </div>

      <input
        type="text"
        placeholder="Search by email or username…"
        value={search}
        onChange={e => handleSearch(e.target.value)}
        className="w-full max-w-sm bg-[#111] border border-[#2a2a2a] rounded-lg px-4 py-2.5
                   text-white text-sm focus:border-[#f5c518] outline-none transition"
      />

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['User', 'Role', 'Credits', '2FA', 'Joined', 'Actions'].map(h => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-gray-400 font-medium ${
                      h === 'Actions' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-[#1a1a1a] transition">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{u.email}</p>
                    <p className="text-xs text-gray-500">@{u.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-red-500/10 text-red-400'
                          : u.role === 'ADMIN'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#f5c518] font-mono">
                    {u.credit_balance}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${
                        u.totp_enabled ? 'text-green-400' : 'text-gray-600'
                      }`}
                    >
                      {u.totp_enabled ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => adjustCredits(u.id, 10)}
                        className="text-xs px-2 py-1 bg-[#f5c518]/10 text-[#f5c518]
                                   rounded hover:bg-[#f5c518]/20 transition"
                      >
                        +10 cr
                      </button>
                    </div>
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
