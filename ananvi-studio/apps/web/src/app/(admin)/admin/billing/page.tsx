'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';

const PER_PAGE = 20;

interface Payment {
  id: string;
  user_id: string;
  amount_usd: number;
  credits_granted: number;
  provider: string;
  provider_payment_id: string;
  status: string;
  created_at: string;
}

interface BillingStats {
  total_revenue_usd: number;
  total_credits_sold: number;
  total_transactions: number;
  avg_credits_per_purchase: number;
}

interface BillingOverview {
  stats: BillingStats;
  payments: Payment[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

function useBillingOverview(page: number) {
  return useQuery<{ success: boolean; data: BillingOverview }>({
    queryKey: ['admin-billing', page],
    queryFn: () =>
      api
        .get('/admin/billing', { params: { page, per_page: PER_PAGE } })
        .then(r => r.data),
    placeholderData: keepPreviousData,
  });
}

function formatUsd(amount: number) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
  failed: 'bg-red-500/10 text-red-400',
  refunded: 'bg-gray-500/10 text-gray-400',
};

const COLUMNS = ['Date', 'User ID', 'Amount (USD)', 'Credits Granted', 'Provider', 'Status'];

export default function AdminBillingPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useBillingOverview(page);

  const overview = data?.data;
  const stats = overview?.stats;
  const payments = overview?.payments ?? [];
  const totalPages = overview?.total_pages ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-gray-400 mt-1">Revenue and payment overview</p>
      </div>

      {isError ? (
        <div className="bg-[#111] border border-red-500/30 rounded-xl p-5 flex items-center justify-between">
          <p className="text-sm text-red-400">
            Failed to load billing data{error instanceof Error ? `: ${error.message}` : ''}
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading || !stats
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 animate-pulse"
                  >
                    <div className="h-4 w-24 bg-[#2a2a2a] rounded" />
                    <div className="h-7 w-32 bg-[#2a2a2a] rounded mt-2" />
                  </div>
                ))
              : [
                  { label: 'Total Revenue (USD)', value: formatUsd(stats.total_revenue_usd) },
                  { label: 'Credits Sold', value: stats.total_credits_sold.toLocaleString() },
                  {
                    label: 'Total Transactions',
                    value: stats.total_transactions.toLocaleString(),
                  },
                  {
                    label: 'Avg Credits/Purchase',
                    value: stats.avg_credits_per_purchase.toLocaleString(),
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

          {/* Payments table */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Recent Payments</h2>
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="p-4 space-y-3 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 bg-[#1a1a1a] rounded" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No payments yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2a]">
                      {COLUMNS.map(h => (
                        <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-[#1a1a1a] transition">
                        <td className="px-4 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">{p.user_id}</td>
                        <td className="px-4 py-3 text-white font-medium">
                          {formatUsd(p.amount_usd)}
                        </td>
                        <td className="px-4 py-3 text-[#f5c518] font-mono">
                          {p.credits_granted.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-300 capitalize">{p.provider}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              STATUS_COLOR[p.status] ?? 'bg-gray-500/10 text-gray-400'
                            }`}
                          >
                            {p.status}
                          </span>
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
                    disabled={page >= totalPages}
                    className="text-sm text-gray-400 hover:text-white disabled:opacity-40 transition"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
