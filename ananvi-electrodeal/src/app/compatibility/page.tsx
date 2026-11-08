'use client';

import { useState } from 'react';
import { Layers, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const deviceCategories = ['Smartphone', 'Laptop', 'Tablet', 'Smartwatch', 'TWS Earbuds', 'Gaming Console'];

type CompatResult = { item: string; status: 'compatible' | 'partial' | 'incompatible' };

const mockCompatibility: Record<string, CompatResult[]> = {
  'Smartphone': [
    { item: 'USB-C charging (65W+)', status: 'compatible' },
    { item: 'MagSafe / Wireless charging', status: 'partial' },
    { item: 'Samsung DeX mode', status: 'incompatible' },
    { item: 'Apple CarPlay / Android Auto', status: 'compatible' },
    { item: 'eSIM support (UAE)', status: 'compatible' },
  ],
  'Laptop': [
    { item: 'USB4 / Thunderbolt 4', status: 'compatible' },
    { item: 'HDMI 2.1 output', status: 'partial' },
    { item: 'Windows 11 compatibility', status: 'compatible' },
    { item: 'eGPU support', status: 'incompatible' },
    { item: 'WiFi 6E', status: 'compatible' },
  ],
  'Tablet': [
    { item: 'Apple Pencil (2nd gen)', status: 'partial' },
    { item: 'Smart Keyboard / Magic Keyboard', status: 'compatible' },
    { item: 'USB-C hub/dock', status: 'compatible' },
    { item: 'Cellular (5G)', status: 'compatible' },
    { item: 'Samsung S Pen', status: 'incompatible' },
  ],
  'Smartwatch': [
    { item: 'iPhone compatibility', status: 'partial' },
    { item: 'Android compatibility', status: 'compatible' },
    { item: 'Wear OS apps', status: 'compatible' },
    { item: 'Apple Watch bands', status: 'incompatible' },
    { item: 'NFC payments (UAE)', status: 'compatible' },
  ],
  'TWS Earbuds': [
    { item: 'ANC (Active Noise Cancelling)', status: 'compatible' },
    { item: 'Spatial Audio / Dolby Atmos', status: 'partial' },
    { item: 'Multipoint connection', status: 'compatible' },
    { item: 'Qi wireless charging case', status: 'compatible' },
    { item: 'LDAC / aptX HD', status: 'incompatible' },
  ],
  'Gaming Console': [
    { item: 'HDMI 2.1 TV required', status: 'compatible' },
    { item: '4K @ 120fps display', status: 'partial' },
    { item: 'VRR / ALLM support', status: 'compatible' },
    { item: 'DualSense haptics on PC', status: 'compatible' },
    { item: 'Xbox Play Anywhere titles', status: 'incompatible' },
  ],
};

const statusIcon = {
  compatible: <CheckCircle size={14} className="text-green-400" />,
  partial: <AlertCircle size={14} className="text-yellow-400" />,
  incompatible: <XCircle size={14} className="text-red-400" />,
};

const statusLabel = {
  compatible: 'Compatible',
  partial: 'Partial',
  incompatible: 'Not Compatible',
};

const statusColor = {
  compatible: 'text-green-400',
  partial: 'text-yellow-400',
  incompatible: 'text-red-400',
};

export default function CompatibilityPage() {
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [results, setResults] = useState<CompatResult[] | null>(null);

  const check = () => {
    if (category) setResults(mockCompatibility[category] ?? []);
  };

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-electric-blue to-electric-cyan mb-4 shadow-electric">
            <Layers size={24} className="text-white" />
          </div>
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Device Check</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Compatibility Checker</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm leading-relaxed">
            Check if your device is compatible with accessories, cables, software, and ecosystems before buying.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-white/8 mb-8">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Device Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setResults(null); }}
                  className="w-full appearance-none bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 outline-none focus:border-electric-blue/50 font-mono pr-10"
                >
                  <option value="">Select category...</option>
                  {deviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-silver-500 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-silver-500 mb-1.5 uppercase tracking-wider">Device Model (optional)</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. iPhone 17 Pro, Galaxy S26 Ultra..."
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
              />
            </div>

            <button
              onClick={check}
              disabled={!category}
              className="flex items-center gap-2 px-6 py-3 bg-electric-gradient rounded-xl text-sm font-bold text-white shadow-electric hover:opacity-90 disabled:opacity-40 transition-opacity w-full justify-center"
            >
              <Layers size={15} />
              Check Compatibility
            </button>
          </div>
        </div>

        {results && (
          <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="font-display font-bold text-sm text-white">Compatibility Results — {category}</h2>
            </div>
            <div className="divide-y divide-white/5">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  {statusIcon[r.status]}
                  <span className="flex-1 text-sm text-silver-200">{r.item}</span>
                  <span className={`text-xs font-mono ${statusColor[r.status]}`}>{statusLabel[r.status]}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5 bg-white/2">
              <p className="text-xs text-silver-600 font-mono">Results are based on general specifications. Always verify with the retailer before purchase.</p>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: '🔌', title: 'Cables & Ports', desc: 'USB-C, Lightning, HDMI, Thunderbolt compatibility' },
            { icon: '📡', title: 'Wireless', desc: 'WiFi, Bluetooth, NFC, and 5G band support in UAE' },
            { icon: '💾', title: 'Software', desc: 'OS version and app compatibility checks' },
          ].map((card) => (
            <div key={card.title} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <span className="text-2xl mb-2 block">{card.icon}</span>
              <h3 className="font-display font-semibold text-sm text-white mb-1">{card.title}</h3>
              <p className="text-xs text-silver-500">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
