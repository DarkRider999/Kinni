'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AdminStats {
  total_users: number;
  active_users_7d: number;
  total_jobs: number;
  total_credits_sold: number;
  total_revenue_cents: number;
}

function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    staleTime: 60_000,
  });
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-[#f5c518] mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminStats();
  const stats: AdminStats | null = data?.data ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Platform-wide overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#111] border border-[#2a2a2a] rounded-xl h-24 animate-pulse"
              />
            ))
          : stats
          ? [
              { label: 'Total Users', value: stats.total_users.toLocaleString() },
              {
                label: 'Active (7d)',
                value: stats.active_users_7d.toLocaleString(),
                sub: 'unique logins',
              },
              { label: 'Total Jobs', value: stats.total_jobs.toLocaleString() },
              {
                label: 'Credits Sold',
                value: stats.total_credits_sold.toLocaleString(),
              },
              {
                label: 'Revenue',
                value: `$${(stats.total_revenue_cents / 100).toFixed(2)}`,
                sub: 'all time',
              },
            ].map(k => <KpiCard key={k.label} {...k} />)
          : (
              <div className="col-span-3 text-gray-500 text-center py-8">
                No data available
              </div>
            )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-3">Quick Links</h2>
          <div className="space-y-2">
            {[
              { href: '/admin/users', label: 'Manage Users' },
              { href: '/admin/jobs', label: 'All Jobs' },
              { href: '/admin/billing', label: 'Billing Overview' },
              { href: '/admin/audit', label: 'Audit Log' },
              { href: '/admin/settings', label: 'System Settings' },
            ].map(l => (
              <a
                key={l.href}
                href={l.href}
                className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a]
                           hover:bg-[#222] rounded-lg text-sm text-gray-300
                           hover:text-white transition"
              >
                {l.label}
                <span className="text-gray-600">→</span>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-3">System Status</h2>
          <div className="space-y-3">
            {[
              { label: 'API', status: 'Operational' },
              { label: 'Job Queue', status: 'Operational' },
              { label: 'Payments', status: 'Operational' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{s.label}</span>
                <span className="flex items-center gap-1.5 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
