'use client';

import { useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Search } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts } from '@/lib/mockData';

const mockHistory = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 3600 * 1000).toLocaleDateString('en-AE', { day: '2-digit', month: 'short' }),
  price: 3800 + Math.floor(Math.sin(i * 0.4) * 300 + Math.random() * 100),
}));

export default function PriceHistoryPage() {
  const [selectedId, setSelectedId] = useState(featuredProducts[0].id);
  const selectedProduct = featuredProducts.find((p) => p.id === selectedId)!;

  const lowestPrice = Math.min(...mockHistory.map((h) => h.price));
  const highestPrice = Math.max(...mockHistory.map((h) => h.price));
  const currentPrice = mockHistory[mockHistory.length - 1].price;
  const prevPrice = mockHistory[mockHistory.length - 2].price;
  const trend = currentPrice < prevPrice ? 'down' : currentPrice > prevPrice ? 'up' : 'flat';

  const chartMax = highestPrice + 200;
  const chartMin = lowestPrice - 200;
  const range = chartMax - chartMin;

  const points = mockHistory.map((h, i) => {
    const x = (i / (mockHistory.length - 1)) * 100;
    const y = 100 - ((h.price - chartMin) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">30-Day History</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Price History</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm">
            Track price trends over time and find the best moment to buy.
          </p>
        </div>

        {/* Product selector */}
        <div className="glass-card rounded-2xl p-4 border border-white/8 mb-8">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-electric-cyan" />
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full appearance-none bg-navy-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-silver-100 outline-none focus:border-electric-blue/50 font-mono"
            >
              {featuredProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Current Price', value: `AED ${currentPrice.toLocaleString()}`, color: trend === 'down' ? 'text-green-400' : trend === 'up' ? 'text-red-400' : 'text-white' },
            { label: '30-Day Low', value: `AED ${lowestPrice.toLocaleString()}`, color: 'text-green-400' },
            { label: '30-Day High', value: `AED ${highestPrice.toLocaleString()}`, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <p className="text-xs font-mono text-silver-500 mb-1">{label}</p>
              <p className={`font-display font-bold text-sm ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Trend badge */}
        <div className="flex items-center gap-2 mb-6">
          {trend === 'down' ? (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-xs font-mono text-green-400">
              <TrendingDown size={12} /> Price is falling — good time to buy
            </span>
          ) : trend === 'up' ? (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-400/10 border border-red-400/20 text-xs font-mono text-red-400">
              <TrendingUp size={12} /> Price is rising — consider waiting
            </span>
          ) : (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-silver-400">
              <Minus size={12} /> Price is stable
            </span>
          )}
        </div>

        {/* SVG Chart */}
        <div className="glass-card rounded-2xl p-6 border border-white/8 mb-8">
          <h2 className="font-display font-bold text-white mb-4 text-sm">{selectedProduct.name} — 30-Day Price Chart</h2>
          <div className="relative h-48">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066ff" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={`0,100 ${points} 100,100`}
                fill="url(#chartGrad)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="#00d4ff"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
                className="stroke-2"
              />
            </svg>
            {/* Y labels */}
            <div className="absolute right-0 top-0 h-full flex flex-col justify-between text-right pr-1">
              <span className="text-xs font-mono text-silver-600">AED {highestPrice.toLocaleString()}</span>
              <span className="text-xs font-mono text-silver-600">AED {lowestPrice.toLocaleString()}</span>
            </div>
          </div>
          {/* X labels */}
          <div className="flex justify-between mt-2">
            <span className="text-xs font-mono text-silver-600">{mockHistory[0].date}</span>
            <span className="text-xs font-mono text-silver-600">{mockHistory[mockHistory.length - 1].date}</span>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-display font-bold text-sm text-white">Recent Price Points</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 text-silver-600 uppercase tracking-wider">Date</th>
                  <th className="text-right p-3 text-silver-600 uppercase tracking-wider">Price (AED)</th>
                  <th className="text-right p-3 text-silver-600 uppercase tracking-wider">Change</th>
                </tr>
              </thead>
              <tbody>
                {[...mockHistory].reverse().slice(0, 10).map((h, i, arr) => {
                  const prev = arr[i + 1];
                  const change = prev ? h.price - prev.price : 0;
                  return (
                    <tr key={h.date} className="border-b border-white/5">
                      <td className="p-3 text-silver-400">{h.date}</td>
                      <td className="p-3 text-right text-white">{h.price.toLocaleString()}</td>
                      <td className={`p-3 text-right ${change < 0 ? 'text-green-400' : change > 0 ? 'text-red-400' : 'text-silver-600'}`}>
                        {change === 0 ? '—' : `${change > 0 ? '+' : ''}${change}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
