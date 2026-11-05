'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number; // percentage change
  icon?: React.ReactNode;
  format?: 'number' | 'currency' | 'percent';
}

export function StatCard({ title, value, change, icon, format }: StatCardProps) {
  const formatted = format === 'currency'
    ? `$${Number(value).toLocaleString()}`
    : format === 'percent'
    ? `${value}%`
    : Number(value).toLocaleString();

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-[#666] mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{formatted}</p>
        </div>
        {icon && <div className="text-[#f5c518]">{icon}</div>}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${
          change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-[#666]'
        }`}>
          {change > 0 ? <TrendingUp size={14} /> :
           change < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
          {Math.abs(change).toFixed(1)}% vs last period
        </div>
      )}
    </div>
  );
}
