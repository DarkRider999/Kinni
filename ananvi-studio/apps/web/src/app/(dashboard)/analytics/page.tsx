'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AnalyticsSummary {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  total_clips: number;
  credits_used: number;
  credits_remaining: number;
}

interface DailyUsage {
  date: string;
  jobs: number;
  clips: number;
  credits: number;
}

function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/jobs/stats').then(r => r.data),
    staleTime: 60_000,
  });
}

function useCreditsHistory() {
  return useQuery({
    queryKey: ['credits-history'],
    queryFn: () =>
      api.get('/billing/transactions', { params: { limit: 30 } }).then(r => r.data),
    staleTime: 60_000,
  });
}

const VALUE_COLOR_CLASS: Record<string, string> = {
  white: 'text-white',
  'green-400': 'text-green-400',
  'red-400': 'text-red-400',
  '[#f5c518]': 'text-[#f5c518]',
};

function StatCard({
  label,
  value,
  sub,
  color = 'white',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${VALUE_COLOR_CLASS[color] ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SimpleBar({
  value,
  max,
  color = '#f5c518',
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mt-1">
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AnalyticsPage() {
  const { data: statsRaw, isLoading: statsLoading } = useAnalytics();
  const { data: txRaw, isLoading: txLoading } = useCreditsHistory();

  const stats: AnalyticsSummary | null = statsRaw?.data ?? null;
  const transactions: { type: string; amount: number; created_at: string }[] =
    txRaw?.data ?? [];

  const successRate =
    stats && stats.total_jobs > 0
      ? Math.round((stats.completed_jobs / stats.total_jobs) * 100)
      : 0;

  // Aggregate last 7 days from transactions for a simple chart
  const dailyMap: Record<string, number> = {};
  transactions.forEach(tx => {
    if (tx.amount < 0) {
      const day = tx.created_at.slice(0, 10);
      dailyMap[day] = (dailyMap[day] ?? 0) + Math.abs(tx.amount);
    }
  });
  const days = Object.keys(dailyMap)
    .sort()
    .slice(-7)
    .map(d => ({ date: d, credits: dailyMap[d] }));
  const maxCredits = Math.max(...days.map(d => d.credits), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Your usage statistics and credit history</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-xl h-24 animate-pulse" />
          ))
        ) : stats ? (
          <>
            <StatCard label="Total Jobs" value={stats.total_jobs} />
            <StatCard
              label="Completed"
              value={stats.completed_jobs}
              sub={`${successRate}% success rate`}
              color="green-400"
            />
            <StatCard
              label="Failed"
              value={stats.failed_jobs}
              color={stats.failed_jobs > 0 ? 'red-400' : 'white'}
            />
            <StatCard label="Clips Generated" value={stats.total_clips} />
            <StatCard
              label="Credits Used"
              value={stats.credits_used}
              sub="all time"
              color="[#f5c518]"
            />
            <StatCard
              label="Credits Remaining"
              value={stats.credits_remaining}
              sub="current balance"
              color="[#f5c518]"
            />
          </>
        ) : (
          <div className="col-span-3 text-gray-500 text-center py-8">
            No stats available yet
          </div>
        )}
      </div>

      {/* Job success rate bar */}
      {stats && stats.total_jobs > 0 && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Job Success Rate</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Completed</span>
                <span className="text-green-400">{stats.completed_jobs}</span>
              </div>
              <SimpleBar
                value={stats.completed_jobs}
                max={stats.total_jobs}
                color="#22c55e"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Failed</span>
                <span className="text-red-400">{stats.failed_jobs}</span>
              </div>
              <SimpleBar
                value={stats.failed_jobs}
                max={stats.total_jobs}
                color="#ef4444"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Other</span>
                <span className="text-gray-400">
                  {stats.total_jobs - stats.completed_jobs - stats.failed_jobs}
                </span>
              </div>
              <SimpleBar
                value={stats.total_jobs - stats.completed_jobs - stats.failed_jobs}
                max={stats.total_jobs}
                color="#6b7280"
              />
            </div>
          </div>
        </div>
      )}

      {/* Credits used per day (last 7 days) */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Credits Used — Last 7 Days
        </h2>
        {txLoading ? (
          <div className="h-32 animate-pulse bg-[#1a1a1a] rounded-lg" />
        ) : days.length === 0 ? (
          <p className="text-gray-500 text-sm">No credit usage recorded yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {days.map(d => {
              const h = Math.max(8, Math.round((d.credits / maxCredits) * 112));
              return (
                <div key={d.date} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-[10px] text-gray-500">{d.credits}</span>
                  <div
                    className="w-full rounded-t bg-[#f5c518]/70 hover:bg-[#f5c518] transition"
                    style={{ height: `${h}px` }}
                    title={`${d.credits} credits on ${d.date}`}
                  />
                  <span className="text-[9px] text-gray-600">{formatDate(d.date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent credit transactions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Credit Activity</h2>
        {txLoading ? (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl h-40 animate-pulse" />
        ) : transactions.length === 0 ? (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8 text-center text-gray-500">
            No credit activity yet
          </div>
        ) : (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Type</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Credits</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {transactions.slice(0, 10).map((tx, i) => (
                  <tr key={i} className="hover:bg-[#1a1a1a] transition">
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          tx.amount > 0
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono font-medium ${
                        tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
