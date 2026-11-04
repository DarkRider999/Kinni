'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';

interface Payment {
  id: string;
  user_email: string;
  package_name: string;
  credits: number;
  amount_cents: number;
  status: string;
  created_at: string;
}

function useAdminPayments(page: number) {
  return useQuery({
    queryKey: ['admin-payments', page],
    queryFn: () =>
      api.get('/admin/payments', { params: { page, limit: 20 } }).then(r => r.data),
    placeholderData: keepPreviousData,
  });
}

function useAdminBillingStats() {
  return useQuery({
    queryKey: ['admin-billing-stats'],
    queryFn: () => api.get('/admin/billing/stats').then(r => r.data),
    staleTime: 60_000,
  });
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
  failed: 'bg-red-500/10 text-red-400',
  refunded: 'bg-gray-500/10 text-gray-400',
};

export default function AdminBillingPage() {
  const [page, setPage] = useState(1);

  const { data: statsRaw } = useAdminBillingStats();
  const { data, isLoading } = useAdminPayments(page);

  const payments: Payment[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const stats = statsRaw?.data ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-gray-400 mt-1">Revenue and payment overview</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: formatCents(stats.total_revenue_cents ?? 0) },
            { label: 'Total Payments', value: (stats.total_payments ?? 0).toLocaleString() },
            {
              label: 'Credits Sold',
              value: (stats.total_credits_sold ?? 0).toLocaleString(),
            },
            {
              label: 'Avg Order',
              value: formatCents(
                stats.total_payments
                  ? Math.round(stats.total_revenue_cents / stats.total_payments)
                  : 0,
              ),
            },
          ].map(k => (
            <div
              key={k.label}
              className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5"
            >
              <p className="text-sm text-gray-400">{k.label}</p>
              <p className="text-2xl font-bold text-[#f5c518] mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Payments table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Payments</h2>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No payments yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['User', 'Package', 'Credits', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-[#1a1a1a] transition">
                    <td className="px-4 py-3 text-gray-300 text-xs">{p.user_email}</td>
                    <td className="px-4 py-3 text-gray-300">{p.package_name}</td>
                    <td className="px-4 py-3 text-[#f5c518] font-mono">{p.credits}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      {formatCents(p.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          STATUS_COLOR[p.status] ?? 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.created_at)}</td>
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
    </div>
  );
}
