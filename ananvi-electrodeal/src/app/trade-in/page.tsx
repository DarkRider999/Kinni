'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { RefreshCw, ChevronDown, Zap } from 'lucide-react';

const categories = ['Smartphone', 'Laptop', 'Tablet', 'Gaming Console', 'Smartwatch', 'Camera', 'TV', 'Audio'];
const conditions = [
  { value: 'excellent', label: 'Excellent — Like new, minimal signs of use' },
  { value: 'good', label: 'Good — Light scratches, fully functional' },
  { value: 'fair', label: 'Fair — Visible wear, works as intended' },
  { value: 'poor', label: 'Poor — Heavy wear or minor functional issues' },
];

const mockEstimates: Record<string, Record<string, number>> = {
  Smartphone: { excellent: 1800, good: 1400, fair: 900, poor: 500 },
  Laptop: { excellent: 2500, good: 2000, fair: 1300, poor: 700 },
  Tablet: { excellent: 900, good: 700, fair: 450, poor: 250 },
  'Gaming Console': { excellent: 1200, good: 950, fair: 650, poor: 350 },
  Smartwatch: { excellent: 600, good: 480, fair: 300, poor: 150 },
  Camera: { excellent: 1500, good: 1200, fair: 800, poor: 400 },
  TV: { excellent: 2000, good: 1600, fair: 1000, poor: 500 },
  Audio: { excellent: 500, good: 400, fair: 250, poor: 120 },
};

export default function TradeInPage() {
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState('');
  const [estimate, setEstimate] = useState<number | null>(null);

  const getEstimate = () => {
    if (category && condition) {
      const base = mockEstimates[category]?.[condition] ?? 500;
      setEstimate(base + Math.floor(Math.random() * 100));
    }
  };

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-electric-blue mb-4 shadow-electric">
            <RefreshCw size={24} className="text-white" />
          </div>
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Free Valuation</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Trade-In Value Finder</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm leading-relaxed">
            Get an instant estimate for your old device. Compare trade-in offers from UAE retailers and
            find out how much your device is worth today.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-white/8 mb-8">
          <div className="space-y-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Device Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setEstimate(null); }}
                  className="w-full appearance-none bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 outline-none focus:border-electric-blue/50 font-mono pr-10"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-silver-500 pointer-events-none" />
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Device Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. iPhone 15 Pro, Samsung S24 Ultra..."
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
              />
            </div>

            {/* Condition */}
            <div>
              <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Device Condition</label>
              <div className="space-y-2">
                {conditions.map(({ value, label }) => (
                  <label key={value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${condition === value ? 'border-electric-blue/50 bg-electric-blue/5' : 'border-white/5 glass-card hover:border-white/15'}`}>
                    <input
                      type="radio"
                      name="condition"
                      value={value}
                      checked={condition === value}
                      onChange={() => { setCondition(value); setEstimate(null); }}
                      className="mt-0.5 accent-blue-500"
                    />
                    <span className="text-sm text-silver-200">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={getEstimate}
              disabled={!category || !condition}
              className="flex items-center gap-2 px-6 py-3 bg-electric-gradient rounded-xl text-sm font-bold text-white shadow-electric hover:opacity-90 disabled:opacity-40 transition-opacity w-full justify-center"
            >
              <Zap size={15} />
              Get Instant Estimate
            </button>
          </div>
        </div>

        {estimate !== null && (
          <div className="glass-card rounded-2xl p-8 border border-green-400/20 text-center animate-pulse-once">
            <p className="text-xs font-mono text-silver-500 uppercase tracking-widest mb-2">Estimated Trade-In Value</p>
            <div className="font-display font-black text-5xl text-white mb-1">
              <span className="text-xs font-mono text-electric-cyan">AED </span>
              {estimate.toLocaleString()}
            </div>
            <p className="text-xs text-silver-500 font-mono mb-6">Based on current UAE market rates</p>
            <div className="grid grid-cols-3 gap-3">
              {['Noon.com', 'Cartlow', 'Revibe'].map((retailer) => (
                <div key={retailer} className="glass-card rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-xs font-mono text-silver-500 mb-1">{retailer}</p>
                  <p className="font-display font-bold text-sm text-white">
                    AED {(estimate - Math.floor(Math.random() * 200)).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
