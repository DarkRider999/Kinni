'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CouponCard from '@/components/ui/CouponCard';
import { featuredCoupons as coupons } from '@/lib/mockData';
import type { CouponStatus } from '@/lib/types';

const statusFilters: { value: CouponStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Coupons' },
  { value: 'verified', label: 'Verified' },
  { value: 'recently-verified', label: 'Recently Verified' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'expired', label: 'Expired' },
];

export default function CouponsPage() {
  const [statusFilter, setStatusFilter] = useState<CouponStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = coupons.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.code.toLowerCase().includes(q) ||
        c.retailer.name.toLowerCase().includes(q) ||
        c.terms.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">AI-Verified Codes</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Active Coupons</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm">
            Coupon codes tested and verified by our AI every 6 hours. Success rates shown in real time.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-electric-cyan" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search codes, retailers..."
              className="w-full bg-navy-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
                  statusFilter === f.value
                    ? 'bg-electric-gradient text-white border-transparent shadow-electric'
                    : 'glass-card text-silver-400 border-white/10 hover:border-electric-blue/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-silver-600 font-mono mb-6">{filtered.length} coupons found</p>

        {filtered.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🏷️</div>
            <h3 className="font-display font-bold text-xl text-white mb-2">No coupons found</h3>
            <p className="text-silver-400 text-sm mb-6">Try a different filter or search term</p>
            <button
              onClick={() => { setStatusFilter('all'); setSearch(''); }}
              className="px-6 py-2.5 bg-electric-gradient rounded-lg text-sm font-semibold text-white"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
