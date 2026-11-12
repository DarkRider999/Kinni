'use client';

import { useState } from 'react';
import { Bell, Plus, Trash2, TrendingDown, Zap, Check } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts } from '@/lib/mockData';

type Alert = { id: string; productName: string; targetPrice: number; currentPrice: number };

const mockAlerts: Alert[] = [
  { id: '1', productName: 'iPhone 17 Pro Max', targetPrice: 4500, currentPrice: 4299 },
  { id: '2', productName: 'MacBook Pro M4 14"', targetPrice: 7000, currentPrice: 7499 },
];

export default function DealRadarPage() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [saved, setSaved] = useState(false);

  const removeAlert = (id: string) => setAlerts(alerts.filter((a) => a.id !== id));

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-electric-blue mb-4 shadow-electric">
            <Bell size={24} className="text-white" />
          </div>
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Price Intelligence</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Deal Radar</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm leading-relaxed">
            Set your target price. We watch 11 UAE retailers 24/7 and alert you the moment a deal hits.
          </p>
        </div>

        {/* How it works */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { n: '1', title: 'Set Target Price', desc: 'Tell us your budget for any product' },
            { n: '2', title: 'We Monitor', desc: 'AI checks prices every hour across all retailers' },
            { n: '3', title: 'Get Alerted', desc: 'Instant notification when price drops to your target' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <div className="w-8 h-8 rounded-lg bg-electric-gradient text-white font-display font-black text-sm flex items-center justify-center mx-auto mb-3 shadow-electric">
                {n}
              </div>
              <h3 className="font-display font-semibold text-sm text-white mb-1">{title}</h3>
              <p className="text-xs text-silver-400">{desc}</p>
            </div>
          ))}
        </div>

        {/* Active alerts */}
        <div className="mb-8">
          <h2 className="font-display font-bold text-white mb-4">Your Active Alerts ({alerts.length})</h2>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const triggered = alert.currentPrice <= alert.targetPrice;
              return (
                <div key={alert.id} className={`glass-card rounded-xl p-4 border transition-all ${triggered ? 'border-green-400/40 bg-green-400/5' : 'border-white/8'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${triggered ? 'bg-green-400/20' : 'bg-electric-blue/10'}`}>
                      {triggered ? <Check size={18} className="text-green-400" /> : <Bell size={18} className="text-electric-cyan" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{alert.productName}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                        <span className="text-silver-500">Target: <span className="text-electric-cyan">AED {alert.targetPrice.toLocaleString()}</span></span>
                        <span className="text-silver-500">Current: <span className={triggered ? 'text-green-400' : 'text-white'}>{alert.currentPrice.toLocaleString()}</span></span>
                      </div>
                      {triggered && (
                        <p className="text-xs text-green-400 font-mono mt-1">🎉 Price target reached!</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="p-2 text-silver-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add new alert CTA */}
        <div className="glass-card rounded-2xl p-6 border border-electric-blue/20 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-card-glow opacity-20" />
          <div className="relative z-10">
            <Zap size={28} className="text-electric-cyan mx-auto mb-3" />
            <h3 className="font-display font-bold text-white mb-2">Set a New Alert</h3>
            <p className="text-silver-400 text-sm mb-5">Search for any product and set your target price</p>
            <div className="flex gap-3 max-w-sm mx-auto">
              <input
                type="text"
                placeholder="Search product..."
                className="flex-1 bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
              />
              <button className="flex items-center gap-2 px-4 py-2.5 bg-electric-gradient rounded-xl text-sm font-bold text-white shadow-electric">
                <Plus size={15} />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
